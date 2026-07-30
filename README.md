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
Una volta pubblicato online, l'app salva invece i dati nel **localStorage del browser**:
- i dati restano solo su quel computer/browser specifico (se apri il sito da un altro
  telefono o computer, non li vedrai — non è un archivio condiviso tra gli operatori);
- se cancelli la cache/i dati del browser, o usi la navigazione in incognito, i dati si perdono;
- va benissimo per usarlo da un unico PC/tablet in sala radio, ma **non è adatto** a un
  uso condiviso da più postazioni contemporaneamente senza un backend/database vero.

Se in futuro vuoi un archivio condiviso tra più operatori/dispositivi (es. tutti vedono
le stesse schede missione in tempo reale), serve un piccolo database online (es. Supabase
o Firebase, gratuiti per iniziare) al posto del localStorage — se ti interessa, possiamo
predisporlo.

## Nota sul dominio
Se in futuro vuoi un indirizzo personalizzato (es. `iris.tuosito.it`) invece di
`github.io`, GitHub Pages lo supporta: basta aggiungere un file `CNAME` con dentro il
tuo dominio e configurare il DNS. Dimmelo pure quando ti serve.
