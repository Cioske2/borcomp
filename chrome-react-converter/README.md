# Chrome React Converter — README

Descrizione
-----------
"Chrome React Converter" è un'estensione per Chrome (Manifest V3) che permette di selezionare una porzione di una pagina web e generare automaticamente un progetto React modulare a partire dall'HTML/CSS/JS rilevato. L'estensione cerca di ricostruire componenti riutilizzabili, convertire l'HTML in JSX, estrarre stili (inline o in file CSS) e confezionare il risultato in un archivio .zip scaricabile.

Caratteristiche principali
-------------------------
- Selezione visuale di un elemento in pagina con overlay e click-to-select.
- Serializzazione del subtree selezionato (HTML, attributi, stile computato minimo, eventi inline individuati).
- Heuristics per identificare componenti ripetuti (liste) e separare sezioni comuni (Header, Navbar, Footer, Sidebar, ecc.).
- Conversione HTML -> JSX (mappatura `class` -> `className`, `for` -> `htmlFor`, `srcset` -> `srcSet`, preservazione `aria-*` e `role`, gestione di void tag).
- Possibilità di estrarre gli stili in `styles.css` oppure in-line come `style` React.
- Anteprima del progetto generato nella popup/viewer dell'estensione.
- Download del progetto come file .zip pronto per essere importato in un progetto React.

Requisiti
---------
- Google Chrome (o browser compatibile con estensioni Chrome).
- Modalità sviluppatore attivata per caricare l'estensione non impacchettata durante lo sviluppo.

Installazione (sviluppo)
------------------------
1. Apri `chrome://extensions` in Chrome.
2. Attiva "Developer mode" (in alto a destra).
3. Clicca su "Load unpacked" e seleziona la cartella del progetto: la cartella che contiene `manifest.json` (es. la cartella `chrome-react-converter`).
4. Dopo il caricamento, puoi cliccare su "Inspect background page" (inglese: "service worker") per vedere i log del service worker (utile per debugging).

Uso
---
1. Apri una pagina web (NON `chrome://` o pagine del browser che non consentono script di contenuto).
2. Clicca sull'icona dell'estensione nella barra degli strumenti.
3. Nella popup, premi il pulsante per attivare la modalità selezione, poi clicca sull'elemento da cui vuoi generare il codice.
4. Attendi la generazione: la popup/viewer mostrerà una preview e i file generati.
5. Puoi copiare singoli file, visualizzare il codice dei componenti o scaricare l'intero progetto come `.zip`.

Opzioni disponibili
-------------------
- Esterni vs Inline CSS: scegli se estrarre gli stili in `styles.css` o convertire gli stili in-line nel JSX.
- Anteprima automatica: apre il viewer in una nuova scheda dopo la generazione.

Struttura del progetto generato (esempio)
-----------------------------------------
Il pacchetto generato segue una struttura semplice, pronta per essere importata in un progetto React:

- package.json (boilerplate)
- README.md (breve nota generata)
- src/
  - index.js (entry)
  - App.jsx (componente principale)
  - components/
    - Header.jsx
    - Item.jsx (se presenti liste rilevate)
    - ...altri componenti
  - styles.css (se si è scelto l'estrazione in file)
- public/
  - index.html (piccolo viewer se presente)

Note tecniche e limitazioni
--------------------------
- Manifest V3: il background è un service worker — alcune API e pattern tipici di MV2 non sono disponibili.
- Pagine con restrizioni (es. `chrome://`, `about:`, pagine interne del browser) non consentono l'iniezione del content script; la popup mostrerà un avviso.
- Fogli di stile cross-origin: per motivi di CORS non sempre è possibile leggere tutte le regole CSS esterne. In questi casi l'estensione usa gli stili computati come fallback, ma pseudo-classi e media query potrebbero non essere preservate fedelmente.
- Event handlers complessi (JS che vive al di fuori degli attributi inline) non vengono automaticamente convertiti in logica React funzionante; l'estensione crea stub/commenti per indicare dove reintegrare la logica.
- Non è garantita una conversione perfetta per markup complessi o framework-specific markup (es. Shadow DOM, Web Components, markup generato dinamicamente dopo interazioni complesse).

Debug & troubleshooting
-----------------------
- Se la selezione non parte o la popup riceve l'errore "Could not establish connection": è probabile che il content script non sia stato iniettato (pagina bloccata o `chrome://`). Prova su una pagina pubblica (es. https://example.com).
- Controlla i log del service worker: vai su `chrome://extensions`, trova l'estensione e clicca su "Service Worker (Inspect)" per aprire la console del service worker.
- Se il download .zip non parte, verifica la console del service worker: l'ambiente MV3 usa una strategia di fallback per creare data URL per il download.

Suggerimenti post-estrazione
---------------------------
- Dopo il download, per eseguire il progetto generato rapidamente consigliamo Vite (consigliato) o Create React App:

  - Vite (veloce):

  ```bash
  npm init vite@latest my-app --template react
  # oppure adattare i file generati in una app vite esistente
  cd my-app
  npm install
  npm run dev
  ```

  - Create React App:

  ```bash
  npx create-react-app my-app
  # copiare i file generati in `src/` e `public/`
  cd my-app
  npm install
  npm start
  ```

- Alcune proprietà CSS (es. `box-shadow`, `transform`, `filters`) vengono mappate come stringhe nel prop `style` per preservare fedeltà visiva.

Sicurezza e privacy
-------------------
L'estensione richiede permessi limitati (es. `activeTab`, `scripting`, `downloads`). Tutte le trasformazioni avvengono localmente nel browser: nessun dato viene inviato a server esterni.

Contribuire
----------
Se vuoi contribuire:
- Apri una issue per bug o feature richieste.
- Invia PR con tests e documentazione.

License
-------
Licenza: MIT 


