import React, { useState, useEffect, useCallback } from "react";
import {
  Radio, Ambulance, Users, ClipboardList, Plus, Trash2, Download, X,
  AlertTriangle, ChevronRight, ChevronDown, Clock, Siren, ArrowRight,
} from "lucide-react";

// ================= Costanti =================
const COLORI = {
  verde: { bg: "#16a34a", label: "VERDE", desc: "Non urgente" },
  giallo: { bg: "#eab308", label: "GIALLO", desc: "Urgente" },
  rosso: { bg: "#dc2626", label: "ROSSO", desc: "Emergenza" },
};
const TIPI_RISORSA = ["Ambulanza", "Radio", "Personale"];

// Stati rapidi del mezzo/risorsa, mostrati nella barra laterale.
// "campo" indica quale orario della scheda missione viene aggiornato quando si seleziona lo stato.
const STATI_MEZZO = [
  { id: "operativo", label: "Operativo", short: "OPER.", color: "#16a34a", campo: null },
  { id: "diretto_intervento", label: "Diretto intervento", short: "DIR. INT.", color: "#eab308", campo: "oraAttivazione" },
  { id: "sul_intervento", label: "Sull'intervento", short: "S. INT.", color: "#f97316", campo: "oraSulPosto" },
  { id: "diretto_ospedale", label: "Diretto ospedale", short: "DIR. OSP.", color: "#dc2626", campo: "oraTrasporto" },
  { id: "in_ospedale", label: "In ospedale", short: "OSPEDALE", color: "#a855f7", campo: "oraOspedale" },
  { id: "libero_rientro", label: "Libero in rientro", short: "RIENTRO", color: "#38bdf8", campo: "oraRitorno" },
];
const STATO_ALTRO = { id: "altro", label: "Altro", short: "ALTRO", color: "#64748b", campo: null };

// Trova, tra le missioni dell'evento, la più recente a cui la risorsa risulta assegnata e
// non ancora conclusa: è quella su cui riportare gli orari quando cambia lo stato del mezzo.
function findActiveMissionForResource(missions, log, resourceId) {
  for (const m of missions) {
    if (m.risorse && m.risorse.some((r) => r.resourceId === resourceId)) {
      const le = log.find((l) => l.missionId === m.id);
      if (!le || le.stato !== "conclusa") return m;
    }
  }
  return null;
}

const EVENTO_TIPI = [
  "Perdita di coscienza", "Convulsioni", "Malessere", "Caduta", "Incidente stradale",
  "Avvelenamento", "Evento violento", "Infortunio", "Travaglio/parto", "Malore", "Altro",
];
const LUOGO_EVENTO_OPZ = ["Casa", "Strada", "Uffici/Esercizi pubb.", "Impianto sportivo", "Impianto lavorativo", "Altro"];
const LESIONI_OPZ = [
  "Amputazione", "Frattura esposta", "Deformità", "Dolore", "Sanguinamento", "Emorragia massiva",
  "Ferita", "Ferita penetrante", "Lacerazione/schiacciamento", "Contusione", "Ustione", "Edema",
  "Lesioni incompatibili con la vita",
];
const CPSS_OPZ = ["Deviazione rima labiale", "Segni di lato", "Alterazioni del linguaggio"];
const AVPU_OPZ = [["sveglio", "Sveglio"], ["reagisce_chiamata", "Reagisce chiamata"], ["reagisce_dolore", "Reagisce dolore"], ["incosciente", "Incosciente"]];
const RESPIRO_OPZ = [["normale", "Normale"], ["difficoltoso", "Difficoltoso"], ["assente", "Assente"]];

const uid = () => Math.random().toString(36).slice(2, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

function formatMissionNumber(eventDateStr, seq) {
  const d = eventDateStr ? new Date(eventDateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${dd}${mm}${String(seq).padStart(3, "0")}`;
}

function emptyPaziente() {
  return {
    id: uid(), cognome: "", nome: "", sesso: "", eta: "",
    eventoTipi: [], eventoAltro: "", luogoEvento: "", luogoEventoAltro: "",
    coscienza: "", respiro: "",
    circolo: { tipo: "", ritmo: "", assente: false },
    cute: { temp: "", colore: "", sudata: false },
    fr: "", satAria: "", satO2: "", fc: "", pa: "", temp: "", glicemia: "",
    lesioni: [], cpss: [],
    acc: { rilevatoDa: "", rcpInCorso: false, accDuranteTrasporto: false, inizioRcpOre: "", nrShock: "", esito: "", roscOre: "" },
    rifiutaTrasporto: false, oraRifiutoTrasporto: "", rifiutaPresidi: false, oraRifiutoPresidi: "",
    codiceTrasporto: "", destinazioneAzienda: "", oraAccettazione: "", note: "",
  };
}
function emptyRisorsaMissione(r) {
  return { resourceId: r.id, nome: r.nome, tipo: r.tipo, oraAttivazione: nowTime(), oraSulPosto: "", oraTrasporto: "", oraOspedale: "", oraRitorno: "" };
}

// ================= Triage =================
// Range di normalità dei parametri vitali (adattabili al protocollo del proprio servizio)
const RANGE_VITALI = {
  fr: [14, 20],          // atti/min
  sat: [95, 100],        // % (sia in aria che in ossigeno)
  fc: [60, 100],         // bpm
  paSist: [100, 140],    // mmHg
  paDiast: [60, 80],     // mmHg
  temp: [36, 37.5],      // °C
  glicemia: [70, 100],   // mg/dl
};
function fuoriRange(val, range) {
  if (val === "" || val === null || val === undefined) return false;
  const n = Number(String(val).replace(",", "."));
  if (Number.isNaN(n)) return false;
  return n < range[0] || n > range[1];
}
function paFuoriRange(pa) {
  if (!pa) return false;
  const m = String(pa).match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return false;
  const sist = Number(m[1]), diast = Number(m[2]);
  return sist < RANGE_VITALI.paSist[0] || sist > RANGE_VITALI.paSist[1] || diast < RANGE_VITALI.paDiast[0] || diast > RANGE_VITALI.paDiast[1];
}
// true se almeno un parametro vitale numerico è fuori dai range di normalità
function parametriVitaliAlterati(p) {
  return (
    fuoriRange(p.fr, RANGE_VITALI.fr) ||
    fuoriRange(p.satAria, RANGE_VITALI.sat) ||
    fuoriRange(p.satO2, RANGE_VITALI.sat) ||
    fuoriRange(p.fc, RANGE_VITALI.fc) ||
    paFuoriRange(p.pa) ||
    fuoriRange(p.temp, RANGE_VITALI.temp) ||
    fuoriRange(p.glicemia, RANGE_VITALI.glicemia)
  );
}
function suggerisciColoreInvio(a) {
  if (a.cosciente === "no" && a.stimoloDoloroso === "no") return "rosso";
  if (a.respiro === "assente") return "rosso";
  if (a.cosciente === "no" && a.stimoloDoloroso === "si") return "giallo";
  if (a.cosciente === "no" && a.stimoloVerbale === "si") return "giallo"; // reagisce alla chiamata
  if (a.respiro === "fa fatica") return "giallo";
  if (a.trauma === "si" && (a.dinamica === "incidente stradale" || a.dinamica === "è stato sbalzato")) return "giallo";
  if (a.dolore === "si") return "giallo";
  if (a.cosciente === "si" && a.respiro === "normale") return "verde";
  return null;
}
// Codice colore di trasporto: rosso se ABC (coscienza/respiro/circolo) alterato — sia come
// valutazione qualitativa sia come parametro numerico — oppure CPSS positiva, RCP/ACC in corso,
// emorragia massiva o lesioni incompatibili con la vita.
function suggerisciColoreTrasporto(p) {
  if (p.rifiutaTrasporto) return null;
  const lesTipi = (p.lesioni || []).map((l) => l.tipo);
  const doloreAlto = (p.lesioni || []).some((l) => l.tipo === "Dolore" && Number(l.scala) >= 7);
  const accAttivo = !!(p.acc && (p.acc.rcpInCorso || p.acc.accDuranteTrasporto || p.acc.esito));
  const cpssPositiva = (p.cpss || []).length > 0;
  const coscienzaAlterata = p.coscienza && p.coscienza !== "sveglio";
  const respiroAlterato = p.respiro && p.respiro !== "normale";
  const circoloAlterato = !!(p.circolo?.assente || p.circolo?.ritmo === "Aritmico");

  if (
    coscienzaAlterata || respiroAlterato || circoloAlterato ||
    cpssPositiva || accAttivo ||
    lesTipi.includes("Emorragia massiva") || lesTipi.includes("Lesioni incompatibili con la vita") ||
    parametriVitaliAlterati(p)
  ) return "rosso";
  if (
    lesTipi.some((t) => ["Frattura esposta", "Ferita penetrante", "Amputazione"].includes(t)) || doloreAlto
  ) return "giallo";
  if (p.coscienza === "sveglio" && p.respiro === "normale") return "verde";
  return null;
}

// ================= Esportazione CSV =================
function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
// Brogliaccio: mezzo, ora, cosa (evento) e, se presente, il numero missione collegato.
function exportBrogliaccioCsv(log) {
  const headers = ["Ora", "N. missione", "Mezzo", "Cosa", "Luogo", "Codice invio", "Stato", "Note"];
  const rows = [headers, ...log.map((l) => [
    l.ora, l.numero || "", l.mezzo || "", l.tipoEvento || "", l.luogo || "",
    l.codiceInvio ? COLORI[l.codiceInvio].label : "", l.stato || "", l.note || "",
  ])];
  downloadCsv("brogliaccio.csv", rows);
}
// Schede missione: dati dell'attivazione + una riga per ciascun paziente con tutti i campi della scheda.
function exportMissioniCsv(missions) {
  const headers = [
    "N. missione", "Ora attivazione", "Luogo", "Codice invio", "Motivo", "Mezzi assegnati",
    "Paziente", "Cognome", "Nome", "Sesso", "Età",
    "Evento", "Luogo evento", "Coscienza", "Respiro", "Circolo", "Cute",
    "FR", "SAT aria", "SAT O2", "FC", "PA", "Temp", "Glicemia",
    "Lesioni", "CPSS", "ACC",
    "Rifiuta trasporto", "Ora rifiuto trasporto", "Rifiuta presidi", "Ora rifiuto presidi",
    "Codice trasporto", "Destinazione", "Ora accettazione", "Note",
  ];
  const rows = [headers];
  missions.forEach((m) => {
    const mezzi = (m.risorse || []).map((r) => r.nome).join(", ");
    (m.pazienti || []).forEach((p, i) => {
      const circolo = [p.circolo?.tipo, p.circolo?.ritmo, p.circolo?.assente ? "Assente" : ""].filter(Boolean).join(" ");
      const cute = [p.cute?.temp, p.cute?.colore, p.cute?.sudata ? "Sudata" : ""].filter(Boolean).join(" ");
      const lesioni = (p.lesioni || []).map((l) => `${l.tipo}${l.zona ? " (" + l.zona + ")" : ""}${l.scala ? " NRS " + l.scala : ""}`).join(" | ");
      const accAttivo = p.acc && (p.acc.rcpInCorso || p.acc.accDuranteTrasporto || p.acc.esito);
      const accEsitoLabel = { trasporto_rcp: "Trasporto con RCP", deceduto: "Deceduto", rosc: "ROSC" }[p.acc?.esito] || "";
      const acc = accAttivo ? [accEsitoLabel, p.acc.rcpInCorso ? "RCP in corso" : "", p.acc.accDuranteTrasporto ? "ACC in trasporto" : "", p.acc.roscOre ? `ROSC ${p.acc.roscOre}` : ""].filter(Boolean).join(" · ") : "";
      const codTrasp = p.rifiutaTrasporto ? "" : (p.codiceTrasporto || suggerisciColoreTrasporto(p) || "");
      rows.push([
        m.numero, m.ora, m.luogo, m.codiceInvio ? COLORI[m.codiceInvio].label : "", m.motivo || "", mezzi,
        `P${i + 1}`, p.cognome, p.nome, p.sesso, p.eta,
        [...(p.eventoTipi || []), p.eventoAltro].filter(Boolean).join(", "),
        p.luogoEvento === "Altro" ? p.luogoEventoAltro : p.luogoEvento,
        p.coscienza, p.respiro, circolo, cute,
        p.fr, p.satAria, p.satO2, p.fc, p.pa, p.temp, p.glicemia,
        lesioni, (p.cpss || []).join(", "), acc,
        p.rifiutaTrasporto ? "SI" : "NO", p.oraRifiutoTrasporto || "",
        p.rifiutaPresidi ? "SI" : "NO", p.oraRifiutoPresidi || "",
        codTrasp ? COLORI[codTrasp].label : "", p.destinazioneAzienda, p.oraAccettazione, p.note,
      ]);
    });
  });
  downloadCsv("schede_missione.csv", rows);
}

// ================= Storage helpers =================
// Dentro Claude usa window.storage; se pubblicata online (es. GitHub Pages) usa il localStorage del browser.
async function loadKey(key, fallback) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(key, false);
      return r ? JSON.parse(r.value) : fallback;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
async function saveKey(key, value) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(key, JSON.stringify(value), false);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { console.error("storage error", e); }
}

// ================= Wizard attivazione =================
const WIZARD_STEPS = [
  { id: "motivo", text: "Cosa è successo? (motivo della chiamata)", type: "text" },
  { id: "cosciente", text: "È cosciente?", options: ["si", "no"] },
  { id: "stimoloVerbale", text: "Risponde allo stimolo verbale?", options: ["si", "no"], showIf: (a) => a.cosciente === "no" },
  { id: "stimoloDoloroso", text: "Risponde allo stimolo doloroso?", options: ["si", "no"], showIf: (a) => a.cosciente === "no" && a.stimoloVerbale === "no" },
  { id: "respiro", text: "Come respira?", options: ["normale", "fa fatica", "assente"] },
  { id: "dolore", text: "Ha dolore?", options: ["si", "no"] },
  { id: "doloreZona", text: "Dove sente dolore?", type: "text", showIf: (a) => a.dolore === "si" },
  { id: "trauma", text: "È un evento traumatico?", options: ["si", "no"] },
  { id: "dinamica", text: "Cosa è successo esattamente?", options: ["è caduto", "è stato sbalzato", "incidente stradale", "altro"], showIf: (a) => a.trauma === "si" },
  { id: "dinamicaAltro", text: "Specifica la dinamica…", type: "text", showIf: (a) => a.trauma === "si" && a.dinamica === "altro" },
  { id: "daQuanto", text: "Da quanto tempo è successo?", type: "text", showIf: (a) => a.trauma === "si" },
  { id: "altro", text: "Altre informazioni utili per i soccorritori?", type: "text" },
];
function relevantSteps(answers) { return WIZARD_STEPS.filter((s) => !s.showIf || s.showIf(answers)); }

function QuestionRow({ step, value, onAnswer, active }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [step.id]); // eslint-disable-line
  return (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 8, borderColor: active ? "#38bdf8" : "#1e293b" }}>
      <div style={{ fontSize: 13, color: active ? "#e2e8f0" : "#94a3b8", fontWeight: 600, marginBottom: 8 }}>{step.text}</div>
      {step.options ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {step.options.map((o) => (
            <button key={o} onClick={() => onAnswer(o)} style={{ ...toggleBtn, ...(value === o ? activeToggle : {}) }}>{o === "si" ? "Sì" : o === "no" ? "No" : o}</button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...input, flex: 1 }} value={text} placeholder="Scrivi qui…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAnswer(text); }} />
          <button style={btnSecondary} onClick={() => onAnswer(text)}>OK</button>
          <button style={btnGhost} onClick={() => onAnswer("")}>Salta</button>
        </div>
      )}
    </div>
  );
}

function Wizard({ resources, onComplete, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [luogo, setLuogo] = useState("");
  const [risorseIds, setRisorseIds] = useState([]);
  const [coloreOverride, setColoreOverride] = useState("");

  const rel = relevantSteps(answers);
  const pending = rel.find((s) => !(s.id in answers));

  const setAnswer = (id, val) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: val };
      // rimuove solo le risposte diventate non pertinenti (es. cambiando "trauma" da sì a no)
      WIZARD_STEPS.forEach((s) => { if (s.showIf && !s.showIf(next) && s.id in next) delete next[s.id]; });
      return next;
    });
  };
  const toggleRes = (id) => setRisorseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const suggerito = suggerisciColoreInvio(answers);
  const codiceFinale = coloreOverride || suggerito;
  // Solo le domande a scelta (sì/no, opzioni) bloccano l'assegnazione: le domande di testo libero sono opzionali
  const mandatoryPending = rel.find((s) => s.options && !(s.id in answers));
  const complete = !mandatoryPending;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Siren size={16} color="#f87171" /> Nuova attivazione — domande al chiamante</div>
        <button style={btnGhost} onClick={onCancel}><X size={14} /> Annulla</button>
      </div>

      {rel.map((s) => <QuestionRow key={s.id} step={s} value={answers[s.id]} active={s.id === pending?.id} onAnswer={(v) => setAnswer(s.id, v)} />)}

      {complete && (
        <div style={{ ...card, marginTop: 6, borderColor: "#38bdf8" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>Assegnazione</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={label2}>Codice invio suggerito:</span>
            {suggerito ? <Badge bg={COLORI[suggerito].bg} color="#0b1220" text={`${COLORI[suggerito].label} · ${COLORI[suggerito].desc}`} /> : <span style={{ color: "#64748b", fontSize: 12 }}>—</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {Object.entries(COLORI).map(([k, c]) => (
              <button key={k} onClick={() => setColoreOverride(coloreOverride === k ? "" : k)} style={{ ...toggleBtn, borderColor: c.bg, color: (coloreOverride || suggerito) === k ? "#0b1220" : c.bg, background: (coloreOverride || suggerito) === k ? c.bg : "transparent" }}>{c.label}</button>
            ))}
          </div>

          <input style={{ ...input, width: "100%", boxSizing: "border-box", marginBottom: 14 }} placeholder="Luogo / indirizzo" value={luogo} onChange={(e) => setLuogo(e.target.value)} />

          <div style={label2}>Chi mandiamo? (mezzi, radio, personale)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {resources.length === 0 && <span style={{ fontSize: 12, color: "#64748b" }}>Nessuna risorsa inserita — aggiungile nella sezione Risorse.</span>}
            {resources.map((r) => (
              <button key={r.id} onClick={() => toggleRes(r.id)} style={{ ...toggleBtn, ...(risorseIds.includes(r.id) ? activeToggle : {}) }}>{r.nome} <span style={{ opacity: 0.6 }}>({r.tipo})</span></button>
            ))}
          </div>

          <button style={btnPrimary} disabled={!codiceFinale} onClick={() => onComplete({ answers, luogo, motivo: answers.motivo, codiceInvio: codiceFinale, risorseIds })}>
            <ArrowRight size={16} /> Conferma attivazione e assegna
          </button>
        </div>
      )}
    </div>
  );
}

// ================= App =================
export default function App() {
  const [events, setEvents] = useState([]);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [tab, setTab] = useState("risorse");
  const [loading, setLoading] = useState(true);

  const [resources, setResources] = useState([]);
  const [log, setLog] = useState([]);
  const [missions, setMissions] = useState([]);
  const [missionSeq, setMissionSeq] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openMissionId, setOpenMissionId] = useState(null);

  useEffect(() => { (async () => { setEvents(await loadKey("events", [])); setLoading(false); })(); }, []);

  useEffect(() => {
    if (!currentEventId) return;
    (async () => {
      setResources(await loadKey(`resources:${currentEventId}`, []));
      setLog(await loadKey(`log:${currentEventId}`, []));
      setMissions(await loadKey(`missions:${currentEventId}`, []));
      setMissionSeq(await loadKey(`missionSeq:${currentEventId}`, 0));
      setTab("attivazioni");
      setOpenMissionId(null);
    })();
  }, [currentEventId]);

  const persistEvents = useCallback(async (next) => { setEvents(next); await saveKey("events", next); }, []);
  const persistResources = useCallback(async (next) => { setResources(next); await saveKey(`resources:${currentEventId}`, next); }, [currentEventId]);
  const persistLog = useCallback(async (next) => { setLog(next); await saveKey(`log:${currentEventId}`, next); }, [currentEventId]);
  const persistMissions = useCallback(async (next) => { setMissions(next); await saveKey(`missions:${currentEventId}`, next); }, [currentEventId]);

  const currentEvent = events.find((e) => e.id === currentEventId);

  const nextMissionNumber = useCallback(async () => {
    const seq = missionSeq + 1;
    setMissionSeq(seq);
    await saveKey(`missionSeq:${currentEventId}`, seq);
    return formatMissionNumber(currentEvent?.date, seq);
  }, [missionSeq, currentEventId, currentEvent]);

  // Cambia rapidamente lo stato di una risorsa (dalla barra laterale): registra l'orario,
  // crea una riga nel brogliaccio e, se la risorsa è assegnata a una missione ancora aperta,
  // aggiorna anche l'orario corrispondente nella scheda missione.
  const setResourceStato = async (resourceId, statoId, customLabel) => {
    const r = resources.find((x) => x.id === resourceId);
    if (!r) return;
    const ora = nowTime();
    const def = statoId === "altro" ? STATO_ALTRO : STATI_MEZZO.find((s) => s.id === statoId);
    if (!def) return;
    const statoLabel = statoId === "altro" ? (customLabel || "Altro") : def.label;

    const nextResources = resources.map((x) => (x.id === resourceId ? { ...x, stato: statoId, statoLabel, statoOra: ora } : x));
    await persistResources(nextResources);

    const logEntry = { id: uid(), ora, mezzo: r.nome, luogo: "", tipoEvento: `Cambio stato: ${statoLabel}`, note: "", stato: "conclusa", missionId: null, numero: null, codiceInvio: "", creato: Date.now() };
    await persistLog([logEntry, ...log]);

    if (def.campo) {
      const activeMission = findActiveMissionForResource(missions, log, resourceId);
      if (activeMission) {
        const nextMissions = missions.map((m) => (m.id !== activeMission.id ? m : { ...m, risorse: m.risorse.map((rr) => (rr.resourceId === resourceId ? { ...rr, [def.campo]: ora } : rr)) }));
        await persistMissions(nextMissions);
      }
    }
  };

  const handleWizardComplete = async ({ answers, luogo, motivo, codiceInvio, risorseIds }) => {
    try {
      const numero = await nextMissionNumber();
      const ora = nowTime();
      const risorse = risorseIds.map((id) => resources.find((r) => r.id === id)).filter(Boolean).map(emptyRisorsaMissione);
      const mission = { id: uid(), numero, ora, luogo, motivo, codiceInvio, risorse, pazienti: [emptyPaziente()] };
      const logEntry = { id: uid(), ora, mezzo: risorse.map((r) => r.nome).join(", "), luogo, tipoEvento: motivo || "Attivazione", note: "", stato: "in corso", missionId: mission.id, numero, codiceInvio, wizardAnswers: answers, creato: Date.now() };
      // Le risorse inviate su un'attivazione passano automaticamente allo stato "Diretto intervento",
      // così la barra laterale resta allineata con la scheda missione appena creata.
      const nextResources = resources.map((r) => (risorseIds.includes(r.id) ? { ...r, stato: "diretto_intervento", statoLabel: "Diretto intervento", statoOra: ora } : r));
      await persistMissions([mission, ...missions]);
      await persistLog([logEntry, ...log]);
      await persistResources(nextResources);
      setWizardOpen(false); setTab("missioni"); setOpenMissionId(mission.id);
    } catch (err) {
      console.error("Errore creazione missione:", err);
      alert("Si è verificato un errore nel salvataggio dell'attivazione. Riprova.");
    }
  };

  const apriSchedaDaLog = async (logEntry) => {
    if (logEntry.missionId) { setTab("missioni"); setOpenMissionId(logEntry.missionId); return; }
    const numero = await nextMissionNumber();
    const mission = { id: uid(), numero, ora: logEntry.ora, luogo: logEntry.luogo, motivo: logEntry.tipoEvento, codiceInvio: logEntry.codiceInvio || "", risorse: [], pazienti: [emptyPaziente()] };
    await persistMissions([mission, ...missions]);
    await persistLog(log.map((l) => (l.id === logEntry.id ? { ...l, missionId: mission.id, numero } : l)));
    setTab("missioni"); setOpenMissionId(mission.id);
  };

  if (loading) return <div style={{ background: "#0b1220", color: "#94a3b8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>caricamento IRIS…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .iris-body { display: flex; align-items: flex-start; max-width: 1400px; margin: 0 auto; }
        .iris-sidebar { width: 240px; flex-shrink: 0; box-sizing: border-box; padding: 14px 10px; position: sticky; top: 62px; max-height: calc(100vh - 62px); overflow-y: auto; border-right: 1px solid #1e293b; }
        .iris-main { flex: 1; min-width: 0; box-sizing: border-box; padding: 16px 16px 60px; }
        @media (max-width: 860px) {
          .iris-body { flex-direction: column; }
          .iris-sidebar { width: 100%; position: static; max-height: none; border-right: none; border-bottom: 1px solid #1e293b; }
        }
      `}</style>
      <TopBar currentEvent={currentEvent} tab={tab} setTab={setTab} onNuovaSerata={() => setCurrentEventId(null)} inEvent={!!currentEventId} />
      {!currentEventId ? (
        <EventoSetup events={events} onCreate={persistEvents} onSelect={setCurrentEventId} onDelete={persistEvents} />
      ) : (
        <div className="iris-body">
          <ResourceStatusBar resources={resources} onSetStato={setResourceStato} onExportBrogliaccio={() => exportBrogliaccioCsv(log)} onExportMissioni={() => exportMissioniCsv(missions)} />
          <div className="iris-main">
            {tab === "risorse" && <Risorse resources={resources} onChange={persistResources} />}
            {tab === "attivazioni" && !wizardOpen && <Attivazioni log={log} onNuova={() => setWizardOpen(true)} onApriScheda={apriSchedaDaLog} />}
            {tab === "attivazioni" && wizardOpen && <Wizard resources={resources} onCancel={() => setWizardOpen(false)} onComplete={handleWizardComplete} />}
            {tab === "brogliaccio" && <Brogliaccio log={log} onChange={persistLog} resources={resources} onApriScheda={apriSchedaDaLog} />}
            {tab === "missioni" && <Missioni missions={missions} resources={resources} onChange={persistMissions} openId={openMissionId} setOpenId={setOpenMissionId} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ================= Top bar =================
function TopBar({ currentEvent, tab, setTab, onNuovaSerata, inEvent }) {
  const NAV = [
    { id: "risorse", label: "Risorse" },
    { id: "attivazioni", label: "Attivazioni" },
    { id: "brogliaccio", label: "Brogliaccio" },
    { id: "missioni", label: "Schede missione" },
  ];
  return (
    <div style={{ borderBottom: "1px solid #1e293b", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0b1220", zIndex: 10, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", boxShadow: "0 0 8px #dc2626" }} />
        <div>
          <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 16 }}>IRIS</div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.5, marginTop: -2 }}>Interfaccia Rapida Interventi Sanitari</div>
        </div>
        {currentEvent && <div style={{ marginLeft: 14, paddingLeft: 14, borderLeft: "1px solid #1e293b", fontSize: 13, color: "#94a3b8" }}>{currentEvent.name} · {currentEvent.date}</div>}
      </div>
      {inEvent && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <select value={tab} onChange={(e) => setTab(e.target.value)} style={{ ...input, appearance: "none", paddingRight: 30, fontWeight: 700, cursor: "pointer" }}>
              {NAV.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: "absolute", right: 9, top: 10, pointerEvents: "none", color: "#64748b" }} />
          </div>
          <button onClick={onNuovaSerata} style={btnGhost}>Nuova serata</button>
        </div>
      )}
    </div>
  );
}

// ================= Barra laterale stato risorse =================
const TIPO_ICON = { Ambulanza: Ambulance, Radio: Radio, Personale: Users };
const sidebarTitle = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10, padding: "0 4px", fontWeight: 700 };

function ResourceStatusBar({ resources, onSetStato, onExportBrogliaccio, onExportMissioni }) {
  return (
    <div className="iris-sidebar">
      <div style={sidebarTitle}>Stato risorse</div>
      {resources.length === 0 && (
        <div style={{ fontSize: 12, color: "#64748b", padding: "0 4px 10px" }}>Nessuna risorsa inserita. Aggiungile nella sezione Risorse.</div>
      )}
      {resources.map((r) => (
        <ResourceStatusCard key={r.id} resource={r} onSetStato={(statoId, custom) => onSetStato(r.id, statoId, custom)} />
      ))}

      <div style={{ ...sidebarTitle, marginTop: 20 }}>Esporta dati</div>
      <button style={{ ...btnSecondary, width: "100%", justifyContent: "center", marginBottom: 8, boxSizing: "border-box" }} onClick={onExportBrogliaccio}>
        <Download size={13} /> Brogliaccio (CSV)
      </button>
      <button style={{ ...btnSecondary, width: "100%", justifyContent: "center", boxSizing: "border-box" }} onClick={onExportMissioni}>
        <Download size={13} /> Schede missione (CSV)
      </button>
    </div>
  );
}

function ResourceStatusCard({ resource, onSetStato }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const current = resource.stato || "operativo";
  const def = current === "altro" ? STATO_ALTRO : (STATI_MEZZO.find((s) => s.id === current) || STATI_MEZZO[0]);
  const badgeLabel = current === "altro" ? (resource.statoLabel || "Altro") : def.label;
  const Icon = TIPO_ICON[resource.tipo] || Ambulance;

  const handleSelect = (e) => {
    const val = e.target.value;
    if (val === "altro") { setCustomOpen(true); return; }
    setCustomOpen(false);
    onSetStato(val);
  };
  const confermaCustom = () => {
    if (!customText.trim()) return;
    onSetStato("altro", customText.trim());
    setCustomText(""); setCustomOpen(false);
  };

  return (
    <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={13} color="#64748b" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{resource.nome}</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: def.color, flexShrink: 0, boxShadow: `0 0 6px ${def.color}` }} />
      </div>

      <div style={{ position: "relative" }}>
        <select
          value={current === "altro" ? "altro" : current}
          onChange={handleSelect}
          style={{ ...input, width: "100%", boxSizing: "border-box", appearance: "none", fontSize: 12, fontWeight: 700, color: def.color, borderColor: def.color, paddingRight: 26, cursor: "pointer" }}
        >
          {STATI_MEZZO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="altro">Altro…</option>
        </select>
        <ChevronDown size={13} style={{ position: "absolute", right: 8, top: 9, pointerEvents: "none", color: def.color }} />
      </div>

      <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6 }}>{badgeLabel}{resource.statoOra ? ` · aggiornato ${resource.statoOra}` : ""}</div>

      {customOpen && (
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <input
            style={{ ...input, flex: 1, fontSize: 11, padding: "5px 6px" }}
            placeholder="Stato personalizzato…"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confermaCustom(); }}
            autoFocus
          />
          <button style={{ ...btnGhost, padding: "5px 8px" }} onClick={confermaCustom}>OK</button>
        </div>
      )}
    </div>
  );
}

// ================= Setup evento =================
function EventoSetup({ events, onCreate, onSelect, onDelete }) {
  const [name, setName] = useState(""); const [date, setDate] = useState(""); const [location, setLocation] = useState("");
  const create = () => {
    if (!name.trim()) return;
    const ev = { id: uid(), name: name.trim(), date: date || new Date().toISOString().slice(0, 10), location: location.trim(), createdAt: Date.now() };
    onCreate([ev, ...events]); setName(""); setDate(""); setLocation(""); onSelect(ev.id);
  };
  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Nuova serata / evento</h1>
      <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Crea lo "sheet" della serata: da qui si aprono risorse, attivazioni, brogliaccio e schede missione.</p>
      <div style={card}>
        <label style={label}>Nome evento</label>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Concerto Piazza Duomo" />
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}><label style={label}>Data</label><input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={label}>Luogo</label><input style={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Es. Piazza Duomo" /></div>
        </div>
        <button style={{ ...btnPrimary, marginTop: 16, width: "100%" }} onClick={create}><Plus size={16} /> Crea evento e apri console</button>
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>Eventi salvati</div>
          {events.map((ev) => (
            <div key={ev.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginBottom: 8 }}>
              <div onClick={() => onSelect(ev.id)} style={{ cursor: "pointer", flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{ev.date} {ev.location && `· ${ev.location}`}</div>
              </div>
              <ChevronRight size={16} color="#64748b" onClick={() => onSelect(ev.id)} style={{ cursor: "pointer" }} />
              <button onClick={() => { if (confirm(`Eliminare "${ev.name}" dalla lista? I dati restano salvati.`)) onDelete(events.filter((e) => e.id !== ev.id)); }} style={{ ...btnGhost, marginLeft: 10, color: "#f87171" }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================= Risorse =================
function Risorse({ resources, onChange }) {
  const [form, setForm] = useState({ tipo: "Ambulanza", nome: "", ruolo: "", note: "" });
  const add = () => { if (!form.nome.trim()) return; onChange([{ id: uid(), ...form, nome: form.nome.trim() }, ...resources]); setForm({ ...form, nome: "", ruolo: "", note: "" }); };
  const remove = (id) => onChange(resources.filter((r) => r.id !== id));
  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select style={{ ...input, width: 140 }} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPI_RISORSA.map((t) => <option key={t}>{t}</option>)}</select>
          <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder={form.tipo === "Personale" ? "Nome e cognome" : "Sigla / nome mezzo"} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Ruolo" value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button style={btnPrimary} onClick={add}><Plus size={16} /> Aggiungi</button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        {TIPI_RISORSA.map((tipo) => {
          const rows = resources.filter((r) => r.tipo === tipo);
          if (!rows.length) return null;
          return (
            <div key={tipo} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 8 }}>{tipo} ({rows.length})</div>
              {rows.map((r) => (
                <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", padding: "10px 14px", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}><span style={{ fontWeight: 600 }}>{r.nome}</span>{r.ruolo && <span style={{ color: "#94a3b8", fontSize: 13 }}> · {r.ruolo}</span>}{r.note && <span style={{ color: "#64748b", fontSize: 12 }}> — {r.note}</span>}</div>
                  <button style={btnGhost} onClick={() => remove(r.id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          );
        })}
        {resources.length === 0 && <div style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>Nessuna risorsa inserita.</div>}
      </div>
    </div>
  );
}

// ================= Attivazioni =================
function Attivazioni({ log, onNuova, onApriScheda }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Avvia una nuova richiesta e assegna il codice colore d'invio.</div>
        <button style={btnPrimary} onClick={onNuova}><Siren size={16} /> Nuova attivazione</button>
      </div>
      {log.length === 0 && <div style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>Nessuna attivazione registrata.</div>}
      {log.map((l) => (
        <div key={l.id} style={{ ...card, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}><Clock size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{l.ora}</span>
          {l.numero && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", background: "#0f172a", padding: "2px 6px", borderRadius: 4 }}>N. {l.numero}</span>}
          <span style={{ fontWeight: 600 }}>{l.tipoEvento}</span>
          {l.luogo && <span style={{ color: "#64748b", fontSize: 13 }}>@ {l.luogo}</span>}
          <span style={{ color: "#94a3b8", fontSize: 13 }}>{l.mezzo}</span>
          {l.codiceInvio && <Badge bg={COLORI[l.codiceInvio].bg} color="#0b1220" text={COLORI[l.codiceInvio].label} />}
          <button style={{ ...btnSecondary, marginLeft: "auto" }} onClick={() => onApriScheda(l)}>{l.missionId ? "Apri scheda missione" : "Crea scheda missione"}</button>
        </div>
      ))}
    </div>
  );
}

// ================= Brogliaccio =================
function Brogliaccio({ log, onChange, resources, onApriScheda }) {
  const [form, setForm] = useState({ ora: nowTime(), mezzo: "", tipoEvento: "", luogo: "", note: "" });
  const add = () => { onChange([{ id: uid(), ...form, stato: "in corso", missionId: null, numero: null, codiceInvio: "", creato: Date.now() }, ...log]); setForm({ ora: nowTime(), mezzo: "", tipoEvento: "", luogo: "", note: "" }); };
  const chiudi = (id) => onChange(log.map((l) => (l.id === id ? { ...l, stato: "conclusa" } : l)));
  const remove = (id) => onChange(log.filter((l) => l.id !== id));
  return (
    <div>
      <div style={card}>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Voce manuale (attività non legate a un'attivazione medica: spostamenti, comunicazioni, ecc.)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...input, width: 90 }} type="time" value={form.ora} onChange={(e) => setForm({ ...form, ora: e.target.value })} />
          <select style={{ ...input, width: 160 }} value={form.mezzo} onChange={(e) => setForm({ ...form, mezzo: e.target.value })}>
            <option value="">Mezzo/radio…</option>
            {resources.filter((r) => r.tipo !== "Personale").map((r) => <option key={r.id} value={r.nome}>{r.nome}</option>)}
          </select>
          <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="Tipo evento" value={form.tipoEvento} onChange={(e) => setForm({ ...form, tipoEvento: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Luogo / settore" value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button style={btnPrimary} onClick={add}><Plus size={16} /> Registra</button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        {log.length === 0 && <div style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>Nessuna voce registrata.</div>}
        {log.map((l) => (
          <div key={l.id} style={{ ...card, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}><Clock size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{l.ora}</span>
              {l.numero && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", background: "#0f172a", padding: "2px 6px", borderRadius: 4 }}>N. {l.numero}</span>}
              <span style={{ fontWeight: 600 }}>{l.mezzo || "—"}</span>
              <span style={{ color: "#94a3b8" }}>{l.tipoEvento}</span>
              {l.luogo && <span style={{ color: "#64748b", fontSize: 13 }}>@ {l.luogo}</span>}
              {l.codiceInvio && <Badge bg={COLORI[l.codiceInvio].bg} color="#0b1220" text={COLORI[l.codiceInvio].label} />}
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: l.stato === "conclusa" ? "#14532d" : "#78350f", color: l.stato === "conclusa" ? "#86efac" : "#fcd34d" }}>{l.stato.toUpperCase()}</span>
            </div>
            {l.note && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{l.note}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={btnSecondary} onClick={() => onApriScheda(l)}>{l.missionId ? "Apri scheda missione" : "+ Apri scheda missione"}</button>
              {l.stato !== "conclusa" && <button style={btnGhost} onClick={() => chiudi(l.id)}>Chiudi</button>}
              <button style={{ ...btnGhost, color: "#f87171" }} onClick={() => remove(l.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= Missioni =================
function Missioni({ missions, resources, onChange, openId, setOpenId }) {
  const open = missions.find((m) => m.id === openId);
  const updateMission = (id, patch) => onChange(missions.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const updatePaziente = (missionId, patientId, patch) => onChange(missions.map((m) => (m.id !== missionId ? m : { ...m, pazienti: m.pazienti.map((p) => (p.id === patientId ? { ...p, ...patch } : p)) })));
  const addPaziente = (missionId) => onChange(missions.map((m) => (m.id !== missionId ? m : { ...m, pazienti: [...m.pazienti, emptyPaziente()] })));
  const removePaziente = (missionId, patientId) => onChange(missions.map((m) => (m.id !== missionId ? m : { ...m, pazienti: m.pazienti.filter((p) => p.id !== patientId) })));
  const remove = (id) => { onChange(missions.filter((m) => m.id !== id)); if (openId === id) setOpenId(null); };

  const exportCsv = () => exportMissioniCsv(missions);

  if (open) {
    return (
      <SchedaMissione
        mission={open} resources={resources}
        onUpdateMission={(patch) => updateMission(open.id, patch)}
        onUpdatePaziente={(pid, patch) => updatePaziente(open.id, pid, patch)}
        onAddPaziente={() => addPaziente(open.id)}
        onRemovePaziente={(pid) => removePaziente(open.id, pid)}
        onClose={() => setOpenId(null)}
        onDelete={() => remove(open.id)}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button style={btnSecondary} onClick={exportCsv}><Download size={14} /> Esporta CSV (Google Sheets)</button>
      </div>
      {missions.length === 0 && <div style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>Nessuna scheda missione. Aprine una da Attivazioni o Brogliaccio.</div>}
      {missions.map((m) => (
        <div key={m.id} onClick={() => setOpenId(m.id)} style={{ ...card, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", background: "#0f172a", padding: "2px 6px", borderRadius: 4 }}>N. {m.numero}</span>
          <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700 }}>{m.ora}</span>
          <span style={{ fontWeight: 600 }}>{m.pazienti.length === 1 ? (m.pazienti[0].nome || m.pazienti[0].cognome ? `${m.pazienti[0].nome} ${m.pazienti[0].cognome}`.trim() : "Paziente non identificato") : `${m.pazienti.length} pazienti`}</span>
          {m.codiceInvio && <span style={{ fontSize: 11, color: "#64748b" }}>invio: <Badge bg={COLORI[m.codiceInvio].bg} color="#0b1220" text={COLORI[m.codiceInvio].label} /></span>}
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {m.pazienti.map((p, i) => {
              const codice = p.rifiutaTrasporto ? null : (p.codiceTrasporto || suggerisciColoreTrasporto(p));
              return p.rifiutaTrasporto ? <Badge key={p.id} bg="#334155" color="#cbd5e1" text="RTS" /> : codice ? <Badge key={p.id} bg={COLORI[codice].bg} color="#0b1220" text={m.pazienti.length > 1 ? `P${i + 1} ${COLORI[codice].label}` : COLORI[codice].label} /> : <Badge key={p.id} bg="#1e293b" color="#64748b" text="DA VALUTARE" />;
            })}
          </span>
          <ChevronRight size={16} color="#64748b" />
        </div>
      ))}
    </div>
  );
}

function Badge({ bg, color, text }) { return <span style={{ background: bg, color, fontWeight: 800, fontSize: 11, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{text}</span>; }
function Section({ title, children }) { return <div style={{ ...card, marginTop: 12 }}>{title && <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>{title}</div>}{children}</div>; }

function SingleToggle({ label: lbl, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label2}>{lbl}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((o) => <button key={o} onClick={() => onChange(value === o ? "" : o)} style={{ ...toggleBtn, ...(value === o ? activeToggle : {}) }}>{o}</button>)}
      </div>
    </div>
  );
}
function MultiToggle({ label: lbl, options, values, onChange }) {
  const vals = values || [];
  const toggle = (o) => onChange(vals.includes(o) ? vals.filter((v) => v !== o) : [...vals, o]);
  return (
    <div style={{ marginBottom: 12 }}>
      {lbl && <div style={label2}>{lbl}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((o) => <button key={o} onClick={() => toggle(o)} style={{ ...toggleBtn, ...(vals.includes(o) ? activeToggle : {}) }}>{o}</button>)}
      </div>
    </div>
  );
}
function NumField({ label: lbl, value, onChange, placeholder, warn }) {
  return (
    <div style={{ minWidth: 100, flex: 1 }}>
      <div style={{ fontSize: 11, color: warn ? "#f87171" : "#64748b", marginBottom: 4 }}>{lbl}{warn ? " ⚠ fuori range" : ""}</div>
      <input style={{ ...input, ...(warn ? { borderColor: "#dc2626", color: "#fca5a5" } : {}) }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TimeField({ label: lbl, value, onChange }) {
  return <div style={{ minWidth: 110 }}><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{lbl}</div><input style={input} type="time" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

// AVPU / respiro con mapping label<->value
function AvpuToggle({ value, onChange }) {
  const map = Object.fromEntries(AVPU_OPZ);
  const rev = Object.fromEntries(AVPU_OPZ.map(([k, l]) => [l, k]));
  return <SingleToggle label="Coscienza (AVPU)" options={AVPU_OPZ.map(([, l]) => l)} value={map[value] || ""} onChange={(l) => onChange(rev[l] || "")} />;
}
function RespiroToggle({ value, onChange }) {
  const map = Object.fromEntries(RESPIRO_OPZ);
  const rev = Object.fromEntries(RESPIRO_OPZ.map(([k, l]) => [l, k]));
  return <SingleToggle label="Respiro" options={RESPIRO_OPZ.map(([, l]) => l)} value={map[value] || ""} onChange={(l) => onChange(rev[l] || "")} />;
}

// Circolo: periferico/centrale, ritmico/aritmico, assente esclude tutto
function CircoloPicker({ value, onChange }) {
  const v = value || { tipo: "", ritmo: "", assente: false };
  const setTipo = (t) => onChange({ ...v, tipo: v.tipo === t ? "" : t, assente: false });
  const setRitmo = (r) => onChange({ ...v, ritmo: v.ritmo === r ? "" : r, assente: false });
  const setAssente = () => onChange(v.assente ? { tipo: "", ritmo: "", assente: false } : { tipo: "", ritmo: "", assente: true });
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label2}>Circolo</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Periferico", "Centrale"].map((o) => <button key={o} disabled={v.assente} onClick={() => setTipo(o)} style={{ ...toggleBtn, opacity: v.assente ? 0.4 : 1, ...(v.tipo === o ? activeToggle : {}) }}>{o}</button>)}
        {["Ritmico", "Aritmico"].map((o) => <button key={o} disabled={v.assente} onClick={() => setRitmo(o)} style={{ ...toggleBtn, opacity: v.assente ? 0.4 : 1, ...(v.ritmo === o ? activeToggle : {}) }}>{o}</button>)}
        <button onClick={setAssente} style={{ ...toggleBtn, borderColor: "#dc2626", color: v.assente ? "#0b1220" : "#f87171", background: v.assente ? "#dc2626" : "transparent" }}>Assente</button>
      </div>
    </div>
  );
}
// Cute: calda/fredda, rosea/cianotica/pallida, sudata a parte
function CutePicker({ value, onChange }) {
  const v = value || { temp: "", colore: "", sudata: false };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label2}>Cute</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Calda", "Fredda"].map((o) => <button key={o} onClick={() => onChange({ ...v, temp: v.temp === o ? "" : o })} style={{ ...toggleBtn, ...(v.temp === o ? activeToggle : {}) }}>{o}</button>)}
        {["Rosea", "Cianotica", "Pallida"].map((o) => <button key={o} onClick={() => onChange({ ...v, colore: v.colore === o ? "" : o })} style={{ ...toggleBtn, ...(v.colore === o ? activeToggle : {}) }}>{o}</button>)}
        <button onClick={() => onChange({ ...v, sudata: !v.sudata })} style={{ ...toggleBtn, ...(v.sudata ? activeToggle : {}) }}>Sudata</button>
      </div>
    </div>
  );
}
// Lesioni con zona + scala dolore
function LesioniPicker({ values, onChange }) {
  const list = values || [];
  const has = (tipo) => list.some((l) => l.tipo === tipo);
  const toggle = (tipo) => onChange(has(tipo) ? list.filter((l) => l.tipo !== tipo) : [...list, { id: uid(), tipo, zona: "", scala: "" }]);
  const updateItem = (id, patch) => onChange(list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: list.length ? 12 : 0 }}>
        {LESIONI_OPZ.map((o) => <button key={o} onClick={() => toggle(o)} style={{ ...toggleBtn, ...(has(o) ? activeToggle : {}) }}>{o}</button>)}
      </div>
      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((l) => (
            <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", background: "#0f172a", padding: "8px 10px", borderRadius: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 150 }}>{l.tipo}</span>
              <input style={{ ...input, flex: 1, minWidth: 120 }} placeholder="Zona" value={l.zona} onChange={(e) => updateItem(l.id, { zona: e.target.value })} />
              {l.tipo === "Dolore" && (
                <select style={{ ...input, width: 80 }} value={l.scala} onChange={(e) => updateItem(l.id, { scala: e.target.value })}>
                  <option value="">NRS</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Risorse assegnate alla missione, con orari
function RisorseMissione({ missionRisorse, allResources, onChange }) {
  const [toAdd, setToAdd] = useState("");
  const already = new Set(missionRisorse.map((r) => r.resourceId));
  const available = allResources.filter((r) => !already.has(r.id));
  const update = (resourceId, patch) => onChange(missionRisorse.map((r) => (r.resourceId === resourceId ? { ...r, ...patch } : r)));
  const remove = (resourceId) => onChange(missionRisorse.filter((r) => r.resourceId !== resourceId));
  const add = () => { if (!toAdd) return; const r = allResources.find((x) => x.id === toAdd); if (!r) return; onChange([...missionRisorse, emptyRisorsaMissione(r)]); setToAdd(""); };
  return (
    <div>
      {missionRisorse.length === 0 && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Nessuna risorsa assegnata.</div>}
      {missionRisorse.map((r) => (
        <div key={r.resourceId} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>{r.nome}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{r.tipo}</span>
            <button style={{ ...btnGhost, marginLeft: "auto", color: "#f87171" }} onClick={() => remove(r.resourceId)}><Trash2 size={13} /></button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <TimeField label="Attivazione" value={r.oraAttivazione} onChange={(v) => update(r.resourceId, { oraAttivazione: v })} />
            <TimeField label="Sul posto" value={r.oraSulPosto} onChange={(v) => update(r.resourceId, { oraSulPosto: v })} />
            <TimeField label="Trasporto" value={r.oraTrasporto} onChange={(v) => update(r.resourceId, { oraTrasporto: v })} />
            <TimeField label="Rientro operativo" value={r.oraRitorno} onChange={(v) => update(r.resourceId, { oraRitorno: v })} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <select style={{ ...input, flex: 1 }} value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
          <option value="">Aggiungi risorsa alla missione…</option>
          {available.map((r) => <option key={r.id} value={r.id}>{r.nome} ({r.tipo})</option>)}
        </select>
        <button style={btnSecondary} onClick={add}><Plus size={14} /> Aggiungi</button>
      </div>
    </div>
  );
}

// ================= Scheda missione (multi-paziente) =================
function SchedaMissione({ mission: m, resources, onUpdateMission, onUpdatePaziente, onAddPaziente, onRemovePaziente, onClose, onDelete }) {
  const [activeId, setActiveId] = useState(m.pazienti[0]?.id);
  useEffect(() => { if (!m.pazienti.find((p) => p.id === activeId)) setActiveId(m.pazienti[0]?.id); }, [m.pazienti]); // eslint-disable-line
  const p = m.pazienti.find((x) => x.id === activeId) || m.pazienti[0];
  const suggerito = suggerisciColoreTrasporto(p);
  const setP = (patch) => onUpdatePaziente(p.id, patch);
  const setAcc = (patch) => onUpdatePaziente(p.id, { acc: { ...p.acc, ...patch } });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button style={btnGhost} onClick={onClose}><X size={14} /> Torna alle schede</button>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#38bdf8", fontWeight: 700 }}>Scheda missione N. {m.numero}</div>
        <button style={{ ...btnGhost, color: "#f87171" }} onClick={() => { if (confirm("Eliminare questa scheda missione?")) onDelete(); }}><Trash2 size={14} /> Elimina</button>
      </div>

      <Section title="Dati missione">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...input, width: 90 }} type="time" value={m.ora} onChange={(e) => onUpdateMission({ ora: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="Luogo (via/piazza, comune)" value={m.luogo} onChange={(e) => onUpdateMission({ luogo: e.target.value })} />
          {m.codiceInvio && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "#64748b" }}>invio:</span><Badge bg={COLORI[m.codiceInvio].bg} color="#0b1220" text={COLORI[m.codiceInvio].label} /></span>}
        </div>
      </Section>

      <Section title="Risorse assegnate alla missione">
        <RisorseMissione missionRisorse={m.risorse} allResources={resources} onChange={(next) => onUpdateMission({ risorse: next })} />
      </Section>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, marginBottom: -4, flexWrap: "wrap" }}>
        {m.pazienti.map((pz, i) => (
          <button key={pz.id} onClick={() => setActiveId(pz.id)} style={{ ...toggleBtn, ...(pz.id === p.id ? activeToggle : {}) }}>
            Paziente {i + 1}{pz.cognome ? ` · ${pz.cognome}` : ""}
          </button>
        ))}
        <button style={btnSecondary} onClick={onAddPaziente}><Plus size={14} /> Aggiungi paziente</button>
        {m.pazienti.length > 1 && <button style={{ ...btnGhost, color: "#f87171" }} onClick={() => onRemovePaziente(p.id)}><Trash2 size={13} /> Rimuovi questo paziente</button>}
      </div>

      <Section title="Dati paziente">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Cognome" value={p.cognome} onChange={(e) => setP({ cognome: e.target.value })} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Nome" value={p.nome} onChange={(e) => setP({ nome: e.target.value })} />
          <select style={{ ...input, width: 90 }} value={p.sesso} onChange={(e) => setP({ sesso: e.target.value })}><option value="">Sesso</option><option value="M">M</option><option value="F">F</option></select>
          <input style={{ ...input, width: 90 }} placeholder="Età" value={p.eta} onChange={(e) => setP({ eta: e.target.value })} />
        </div>
      </Section>

      <Section title="Evento">
        <MultiToggle label="Tipologia evento" options={EVENTO_TIPI} values={p.eventoTipi} onChange={(v) => setP({ eventoTipi: v })} />
        {p.eventoTipi.includes("Altro") && (
          <input style={{ ...input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} placeholder="Specifica l'evento…" value={p.eventoAltro} onChange={(e) => setP({ eventoAltro: e.target.value })} />
        )}
        <SingleToggle label="Luogo dell'evento" options={LUOGO_EVENTO_OPZ} value={p.luogoEvento} onChange={(v) => setP({ luogoEvento: v })} />
        {p.luogoEvento === "Altro" && (
          <input style={{ ...input, width: "100%", boxSizing: "border-box" }} placeholder="Specifica il luogo…" value={p.luogoEventoAltro} onChange={(e) => setP({ luogoEventoAltro: e.target.value })} />
        )}
      </Section>

      <Section title="Valutazione del paziente">
        <AvpuToggle value={p.coscienza} onChange={(v) => setP({ coscienza: v })} />
        <RespiroToggle value={p.respiro} onChange={(v) => setP({ respiro: v })} />
        <CircoloPicker value={p.circolo} onChange={(v) => setP({ circolo: v })} />
        <CutePicker value={p.cute} onChange={(v) => setP({ cute: v })} />
      </Section>

      <Section title="Parametri vitali">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <NumField label="FR (atti/min)" value={p.fr} onChange={(v) => setP({ fr: v })} warn={fuoriRange(p.fr, RANGE_VITALI.fr)} />
          <NumField label="SAT aria (%)" value={p.satAria} onChange={(v) => setP({ satAria: v })} warn={fuoriRange(p.satAria, RANGE_VITALI.sat)} />
          <NumField label="SAT O2 (%)" value={p.satO2} onChange={(v) => setP({ satO2: v })} warn={fuoriRange(p.satO2, RANGE_VITALI.sat)} />
          <NumField label="FC (bpm)" value={p.fc} onChange={(v) => setP({ fc: v })} warn={fuoriRange(p.fc, RANGE_VITALI.fc)} />
          <NumField label="PA (mmHg)" value={p.pa} onChange={(v) => setP({ pa: v })} placeholder="120/80" warn={paFuoriRange(p.pa)} />
          <NumField label="Temp (°C)" value={p.temp} onChange={(v) => setP({ temp: v })} warn={fuoriRange(p.temp, RANGE_VITALI.temp)} />
          <NumField label="Glicemia (mg/dl)" value={p.glicemia} onChange={(v) => setP({ glicemia: v })} warn={fuoriRange(p.glicemia, RANGE_VITALI.glicemia)} />
        </div>
      </Section>

      <Section title="Lesioni e aggravanti">
        <LesioniPicker values={p.lesioni} onChange={(v) => setP({ lesioni: v })} />
      </Section>

      <Section title="CPSS (ictus)">
        <MultiToggle options={CPSS_OPZ} values={p.cpss} onChange={(v) => setP({ cpss: v })} />
      </Section>

      <Section title="Arresto cardiocircolatorio (ACC)">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="Evento rilevato da" value={p.acc.rilevatoDa} onChange={(e) => setAcc({ rilevatoDa: e.target.value })} />
          <TimeField label="Inizio RCP" value={p.acc.inizioRcpOre} onChange={(v) => setAcc({ inizioRcpOre: v })} />
          <NumField label="Nr. shock" value={p.acc.nrShock} onChange={(v) => setAcc({ nrShock: v })} />
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={p.acc.rcpInCorso} onChange={(e) => setAcc({ rcpInCorso: e.target.checked })} /> RCP già in corso</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={p.acc.accDuranteTrasporto} onChange={(e) => setAcc({ accDuranteTrasporto: e.target.checked })} /> ACC durante trasporto</label>
        </div>
        <SingleToggle label="Esito" options={["Trasporto con RCP", "Deceduto", "ROSC"]} value={{ trasporto_rcp: "Trasporto con RCP", deceduto: "Deceduto", rosc: "ROSC" }[p.acc.esito] || ""} onChange={(label) => { const map = { "Trasporto con RCP": "trasporto_rcp", Deceduto: "deceduto", ROSC: "rosc" }; setAcc({ esito: map[label] || "" }); }} />
        {p.acc.esito === "rosc" && <div style={{ marginTop: 8 }}><TimeField label="ROSC ore" value={p.acc.roscOre} onChange={(v) => setAcc({ roscOre: v })} /></div>}
      </Section>

      <Section title="Esito e destinazione">
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={!!p.rifiutaTrasporto} onChange={(e) => setP({ rifiutaTrasporto: e.target.checked })} /> Il paziente rifiuta il trasporto in ospedale</label>
          {p.rifiutaTrasporto && <div style={{ marginTop: 6, marginLeft: 24 }}><TimeField label="Ora rifiuto trasporto" value={p.oraRifiutoTrasporto} onChange={(v) => setP({ oraRifiutoTrasporto: v })} /></div>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={!!p.rifiutaPresidi} onChange={(e) => setP({ rifiutaPresidi: e.target.checked })} /> Il paziente rifiuta l'applicazione dei presidi</label>
          {p.rifiutaPresidi && <div style={{ marginTop: 6, marginLeft: 24 }}><TimeField label="Ora rifiuto presidi" value={p.oraRifiutoPresidi} onChange={(v) => setP({ oraRifiutoPresidi: v })} /></div>}
        </div>
        {!p.rifiutaTrasporto && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={label2}>Codice trasporto suggerito:</span>
              {suggerito ? <Badge bg={COLORI[suggerito].bg} color="#0b1220" text={`${COLORI[suggerito].label} · ${COLORI[suggerito].desc}`} /> : <span style={{ color: "#64748b", fontSize: 12 }}>compila la valutazione sopra</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {Object.entries(COLORI).map(([k, c]) => <button key={k} onClick={() => setP({ codiceTrasporto: p.codiceTrasporto === k ? "" : k })} style={{ ...toggleBtn, borderColor: c.bg, color: (p.codiceTrasporto || suggerito) === k ? "#0b1220" : c.bg, background: (p.codiceTrasporto || suggerito) === k ? c.bg : "transparent" }}>{c.label}</button>)}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Ospedale / azienda destinazione" value={p.destinazioneAzienda} onChange={(e) => setP({ destinazioneAzienda: e.target.value })} />
              <TimeField label="Ora accettazione" value={p.oraAccettazione} onChange={(v) => setP({ oraAccettazione: v })} />
            </div>
          </>
        )}
        <textarea style={{ ...input, minHeight: 70, width: "100%", marginTop: 14, boxSizing: "border-box" }} placeholder="Note / anamnesi" value={p.note} onChange={(e) => setP({ note: e.target.value })} />
      </Section>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#64748b", fontSize: 12 }}>
        <AlertTriangle size={13} /> Strumento di supporto alla registrazione: il codice colore definitivo resta una decisione clinica dell'operatore, secondo il protocollo del proprio servizio.
      </div>
    </div>
  );
}

// ================= stili =================
const card = { background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: 16 };
const input = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none" };
const label = { display: "block", fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };
const label2 = { fontSize: 13, color: "#cbd5e1", marginBottom: 6, fontWeight: 500 };
const btnPrimary = { display: "flex", alignItems: "center", gap: 6, background: "#38bdf8", color: "#0b1220", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnSecondary = { display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#38bdf8", border: "1px solid #38bdf8", borderRadius: 6, padding: "6px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const btnGhost = { display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#94a3b8", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const toggleBtn = { background: "#0f172a", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const activeToggle = { background: "#0c4a6e", color: "#7dd3fc", borderColor: "#38bdf8" };
