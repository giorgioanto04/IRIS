/**
 * IRIS — backend Google Apps Script
 * -----------------------------------------------------------------
 * Incolla TUTTO questo codice in Estensioni → Apps Script del tuo Google Sheet,
 * poi segui le istruzioni nella scheda "Impostazioni" di IRIS per pubblicarlo
 * come app web e ottenere l'URL da incollare in IRIS.
 *
 * Crea/usa due schede (tab) nel foglio, generate automaticamente al primo salvataggio:
 *  - "Storage"  → copia grezza dei dati dell'app (per il multi-dispositivo, non modificarla a mano)
 *  - "Missioni" → una riga per paziente, leggibile e modificabile a mano, comoda da stampare/filtrare
 */

var STORAGE_SHEET = "Storage";

var MISSIONI_HEADER = [
  "chiave", "numero", "ora", "luogo", "motivo", "codiceInvio", "mezziAssegnati",
  "pazienteIndex", "cognome", "nome", "sesso", "eta",
  "eventoTipi", "luogoEvento", "coscienza", "respiro",
  "fr", "satAria", "satO2", "fc", "pa", "temp", "glicemia",
  "lesioni", "cpss", "codiceTrasporto", "destinazioneAzienda", "note", "aggiornato",
];

function getSheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) sh.appendRow(header);
  }
  return sh;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function findRowByKey_(sh, key) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) return i + 1; // 1-based, +1 per header
  }
  return -1;
}

// ---------- GET: lettura (usato per "Carica dati dal foglio" in IRIS) ----------
function doGet(e) {
  try {
    var sh = getSheet_(STORAGE_SHEET, ["chiave", "valore", "aggiornato"]);

    // Lettura multipla: ?keys=a,b,c → { values: { a: {value,updated}, b: {...}, ... } }
    // Usata dal polling automatico del client (ogni 1-2s) per aggiornare tutti i dati
    // con una sola richiesta invece di una per chiave.
    if (e.parameter.keys) {
      var wanted = String(e.parameter.keys).split(",");
      var data = sh.getDataRange().getValues();
      var byKey = {};
      for (var i = 1; i < data.length; i++) byKey[String(data[i][0])] = data[i];
      var values = {};
      wanted.forEach(function (k) {
        var r = byKey[k];
        if (!r) { values[k] = { value: null, updated: 0 }; return; }
        var v = r[1] ? JSON.parse(r[1]) : null;
        var u = r[2] ? new Date(r[2]).getTime() : 0;
        values[k] = { value: v, updated: u };
      });
      return jsonOut_({ values: values });
    }

    var key = e.parameter.key;
    if (!key) return jsonOut_({ error: "Parametro 'key' o 'keys' mancante" });
    var row = findRowByKey_(sh, key);
    if (row === -1) return jsonOut_({ value: null, updated: 0 });
    var raw = sh.getRange(row, 2).getValue();
    var value = raw ? JSON.parse(raw) : null;
    var updatedRaw = sh.getRange(row, 3).getValue();
    var updated = updatedRaw ? new Date(updatedRaw).getTime() : 0;
    return jsonOut_({ value: value, updated: updated });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

// ---------- POST: scrittura ----------
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "kv") return saveKv_(body.key, body.value);
    if (body.action === "saveMission") return saveMission_(body.mission, body.eventName);
    return jsonOut_({ error: "Azione sconosciuta: " + body.action });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function saveKv_(key, value) {
  var sh = getSheet_(STORAGE_SHEET, ["chiave", "valore", "aggiornato"]);
  var row = findRowByKey_(sh, key);
  var now = new Date();
  var json = JSON.stringify(value);
  if (row === -1) {
    sh.appendRow([key, json, now]);
  } else {
    sh.getRange(row, 2).setValue(json);
    sh.getRange(row, 3).setValue(now);
  }
  return jsonOut_({ ok: true });
}

// Nomi di scheda (tab) validi in Google Sheets: niente : \ / ? * [ ], max 100 caratteri.
function sheetNameForEvent_(eventName) {
  var base = String(eventName || "Evento").replace(/[:\\/?*\[\]]/g, "-").trim();
  if (!base) base = "Evento";
  return ("Missioni - " + base).slice(0, 100);
}

// Scrive/aggiorna una riga leggibile per ciascun paziente della missione, in un foglio (tab)
// dedicato all'evento (una scheda per ogni serata/evento creato in IRIS).
function saveMission_(m, eventName) {
  if (!m) return jsonOut_({ error: "Missione mancante" });
  var sh = getSheet_(sheetNameForEvent_(eventName), MISSIONI_HEADER);
  var mezzi = (m.risorse || []).map(function (r) { return r.nome; }).join(", ");
  var now = new Date();
  var pazienti = m.pazienti && m.pazienti.length ? m.pazienti : [{}];

  pazienti.forEach(function (p, idx) {
    var chiave = m.numero + "-" + idx;
    var riga = [
      chiave, m.numero, m.ora, m.luogo, m.motivo, m.codiceInvio, mezzi,
      idx + 1,
      p.cognome || "", p.nome || "", p.sesso || "", p.eta || "",
      (p.eventoTipi || []).join(", "), p.luogoEvento || "", p.coscienza || "", p.respiro || "",
      p.fr || "", p.satAria || "", p.satO2 || "", p.fc || "", p.pa || "", p.temp || "", p.glicemia || "",
      (p.lesioni || []).join(", "), (p.cpss || []).join(", "),
      p.codiceTrasporto || "", p.destinazioneAzienda || "", p.note || "",
      now,
    ];
    var row = findRowByKey_(sh, chiave);
    if (row === -1) {
      sh.appendRow(riga);
    } else {
      sh.getRange(row, 1, 1, riga.length).setValues([riga]);
    }
  });

  return jsonOut_({ ok: true });
}
