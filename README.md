# Pubblicare IRIS online con GitHub Pages (nessun comando richiesto)

Questi file bastano da soli: non serve installare Node, npm o altro. Basta caricarli
su GitHub e accendere "Pages" dalle impostazioni del repository.

## Cosa c'è in questa cartella
- `index.html` — l'app completa (React caricato da CDN, nessuna build necessaria)
- `icon.svg`, `icon-192.png`, `icon-512.png`, `favicon-32.png`, `apple-touch-icon.png` — l'icona dell'app
- `manifest.json` — permette di "installare" IRIS sulla schermata home del telefono

## Passo 1 — Crea l'account e il repository
1. Vai su https://github.com e crea un account (se non ce l'hai già).
2. Clicca in alto a destra sul **+** → **New repository**.
3. Dai un nome, ad esempio `iris-app` (deve essere senza spazi).
4. Lascialo **Public**, non aggiungere nulla (niente README, niente licenza).
5. Clicca **Create repository**.

## Passo 2 — Carica i file (dal sito, senza terminale)
1. Nella pagina del repository appena creato, clicca **uploading an existing file**
   (o "Add file" → "Upload files" se il repo non è vuoto).
2. Trascina dentro **tutti** i file di questa cartella (compreso `index.html`).
3. In basso scrivi un messaggio tipo "Prima versione IRIS" e clicca **Commit changes**.

## Passo 3 — Attiva GitHub Pages
1. Nel repository, vai su **Settings** (in alto).
2. Nel menu a sinistra clicca **Pages**.
3. In "Build and deployment" → "Source" scegli **Deploy from a branch**.
4. In "Branch" scegli **main** e la cartella **/(root)**, poi **Save**.
5. Aspetta 1-2 minuti: in cima alla stessa pagina comparirà l'indirizzo del sito, tipo:
   `https://<tuo-username>.github.io/iris-app/`

Quel link è il tuo IRIS online, aperto a chiunque abbia l'indirizzo. Ogni volta che
vorrai aggiornare l'app, basterà ricaricare i nuovi file dallo stesso "Add file → Upload files".

## Importante: dove vengono salvati i dati
Dentro Claude, IRIS salva risorse/attivazioni/schede missione nel sistema di Claude.
Una volta pubblicato online, l'app salva di base i dati nel **localStorage del browser**
(restano solo su quel computer/browser). Se vuoi che più operatori/computer/telefoni
vedano **la stessa situazione in tempo reale**, collega IRIS a un Google Sheet: vedi la
sezione qui sotto.

## Sincronizzare IRIS con un Google Sheet (multi-dispositivo)
Ora IRIS ha una scheda **Impostazioni** dove incollare l'indirizzo di un piccolo
"programmino" (Google Apps Script) che fa da tramite fra l'app e un tuo foglio Google.
Non serve installare nulla: si scrive direttamente nel sito di Google Sheets.

1. Vai su **sheets.google.com** e crea un foglio nuovo, vuoto. Chiamalo ad es. "IRIS dati".
2. Nel foglio, in alto, apri **Estensioni → Apps Script**.
3. Cancella il codice di esempio e incolla **tutto** il contenuto del file
   `google-apps-script.gs` (incluso in questa cartella).
4. Clicca l'icona del dischetto per salvare il progetto (dagli un nome se richiesto).
5. Clicca **Esegui** una volta sola sulla funzione `doGet` (in alto): Google chiederà
   un'autorizzazione, è il tuo stesso foglio quindi puoi accettare tranquillamente
   ("Avanzate" → "Vai al progetto (non sicuro)" è normale per script personali).
6. Clicca **Deploy → Nuova implementazione**. Come tipo scegli **App web**. In
   "Chi ha accesso" scegli **Chiunque** (serve per usarla da qualsiasi computer/telefono
   senza dover accedere ogni volta con un account Google).
7. Copia l'URL che termina con **/exec**.
8. Apri IRIS, vai nella scheda **Impostazioni**, incolla l'URL nel campo e premi
   "Salva URL".

Da quel momento, i pulsanti **"Salva su Google Sheet"** (nell'elenco Attivazioni e dentro
ogni Scheda missione) scrivono i dati sul foglio, in due schede (tab) create in automatico:
- **Storage** — copia grezza di tutti i dati dell'app (non modificarla a mano, serve solo
  per far vedere agli altri dispositivi la stessa situazione quando premono "Carica dati
  dal foglio" nelle Impostazioni);
- **Missioni** — una riga leggibile per ciascun paziente (numero missione, orario, luogo,
  mezzi assegnati, parametri vitali, ecc.), pensata per essere letta, stampata o filtrata
  direttamente su Google Sheets.

Se in futuro ti serve rigenerare l'URL o cambiare foglio, ripeti i passaggi 6-8 con un
nuovo Google Sheet: bastano pochi minuti.

## Nota sul dominio
Se in futuro vuoi un indirizzo personalizzato (es. `iris.tuosito.it`) invece di
`github.io`, GitHub Pages lo supporta: basta aggiungere un file `CNAME` con dentro il
tuo dominio e configurare il DNS. Dimmelo pure quando ti serve.
