# Changelog — lmuse

## 0.8.1 (2026-10-05)

**Cinque difetti di sicurezza e correttezza chiusi (3° giro di revisione)**

- **I ref degli iframe sovrascrivevano quelli della pagina.** La mappa dei ref era
  unica e globale: uno snapshot di un iframe la azzerava, quindi un `[0]`
  emesso dalla pagina principale finiva per indicare un elemento dell'iframe e
  ogni click successivo colpiva il bersaglio sbagliato. Ora la mappa è per
  documento e i tool che agiscono su un ref accettano `docIndex`.
- **L'allowlist non copriva la navigazione indietro/avanti.** Veniva controllata
  solo _prima_ di agire: dopo un back o un forward l'URL era cambiato e lo
  snapshot successivo leggeva la nuova pagina senza più ricontrollare. Il
  confine è ora riapplicato a ogni lettura di contenuto.
- **Cambio di scheda durante la conferma (TOCTOU).** Tra la richiesta di
  conferma e l'esecuzione l'utente poteva cambiare scheda, e l'azione partiva
  sulla pagina nuova, non su quella approvata. La scheda è ora vincolata
  all'approvazione.
- **«Solo dominio» valeva solo per l'header dello snapshot.** La query string
  degli href (`browser_links`) e degli URL dei tab (`browser_tabs_list`) e
  dell'iframe arrivava comunque al modello, con i suoi identificatori di
  sessione. Ora ogni percorso che mostra un URL passa dalla stessa funzione.
- **Il contenuto degli appunti finiva nel log esportabile.** Il testo passato a
  `browser_clipboard_write` compariva negli argomenti della conferma, e il
  testo letto da `browser_clipboard_read` finiva nel log dei passi, che
  l'utente può esportare come `.md`. Ora nel log ci sono lunghezza e conferma
  di lettura, mai il contenuto.

**Difetto bloccante: nessun provider era utilizzabile**

I 25 SDK dei provider venivano caricati con `import()` dinamico, per tenere
leggero il bundle. Ma nei service worker di estensione MV3 `import()` **non è
supportato**: Chrome lo vieta esplicitamente (`import() is disallowed on
ServiceWorkerGlobalScope`, w3c/ServiceWorker#1356). Ogni task — con qualunque
provider — moriva prima di arrivare al primo tool. Il primo sintomo visibile era
un fuorviante «document is not defined»: lo `__vitePreload` di Vite, che
avvolge ogni `import()`, chiama `document.getElementsByTagName()` nel ramo di
precaricamento e, quando il caricamento fallisce, `window.dispatchEvent()` nel
ramo di errore.

Gli import dei provider sono ora statici: il worker è un file autosufficiente
(1075 KB, 253 KB gzip) invece di 326 KB con 19 chunk mai caricabili.
`scripts/verify-dist.mjs` fallisce se un `import()` dinamico torna nel bundle, e
`scripts/e2e-smoke.mjs` esercita davvero un run completo, che è stato il modo in
cui il difetto è emerso.

**E2E completo: un run reale dell'agente, senza credenziali**

L'e2e ora avvia un run vero (pannello → worker → agente → tool → content script →
DONE → storage) contro un provider OpenAI-compatibile finto in locale. Prima
l'e2e non esercitava mai un run: verificava solo che il pannello si disegnasse.
15 controlli in totale.

**Difetti bloccanti corretti (2° giro di revisione avversariale)**

- **Gli errori dei tool non arrivavano mai all'utente.** `JSON.stringify(new Error())`
  vale `{}` e ogni passo fallito compariva come "tool ✓" con corpo vuoto.
- **`browser_wait` con timeout >10s falliva sempre** e l'errore accusava il
  provider, mentre lo schema ammette 30s. Ora il timeout segue la richiesta.
- **Il run history veniva perso** a ogni modifica di impostazioni: il pannello
  riscriveva le impostazioni con `lastRuns` obsoleto.
- **L'allowlist non era un confine.** Era controllata solo in `browser_navigate`:
  click, digitazione, cambio scheda e le altre 21 azioni operavano su qualunque
  pagina. Ora ogni tool verifica il tab su cui agisce, anche il tab di
  destinazione di focus/duplicazione; l'elenco tab marca quelli fuori perimetro.
- **Le schermate andavano al provider senza conferma** con la policy predefinita,
  e le schermate finivano dalla finestra sbagliata (`getLastFocused`). Ora
  chiedono conferma e catturano la finestra del tab su cui si lavora.
- **Lo stop-text veniva rimappato come errore del provider**: con una condizione
  come "403" o "timeout" l'utente leggeva "Chiave API non valida".
- **"Cancella tutti i dati"** non cancellava i metadati delle chiavi né il marker
  di attività.

**Difetti bloccanti corretti (1° giro)**

- **Il prodotto non funzionava.** `dist/content.js` era un modulo ES, ma
  `chrome.scripting.executeScript({files})` inietta script classici: il listener
  non si registrava e **24 tool su 26 erano inerti**. Ora il content script è
  emesso in IIFE da una build dedicata (`vite.config.content.ts`).
- **Bypass della conferma di navigazione.** Un URL senza schema
  (`evil.example.com:8443/x`, `//evil.example.com`) faceva fallire
  `new URL()` e quindi **saltava la conferma «dominio nuovo»**. Ora si passa
  l'URL normalizzato; 5 test di regressione.
- **Task in coda perso.** `drainQueue` estraeva il task e, se il cooldown non
  era scaduto, non lo rimetteva in coda: andava perso. Ora usa `peekQueue` ed
  estrae solo quando può partire.
- **Auto-lock mai attivo.** L'effetto che segnala l'attività aveva dipendenze
  vuote e leggeva il valore al mount, quindi l'opzione non faceva nulla se
  attivata dopo l'apertura; `syncAlarms` non era chiamata. Corretti entrambi.
- **Impostazioni perse a fine run.** Il worker riscriveva l'intero settings
  letto all'inizio del run, annullando le modifiche fatte dal pannello durante
  il run. Ora rilegge e aggiorna solo `lastRuns`.

**Verifica aggiunta (era la causa per cui i difetti passavano inosservati)**

- L'e2e ora **esercita davvero il prodotto**: inietta il content script in una
  pagina HTTP reale e pretende uno snapshot con gli elementi della pagina.
- `verify-dist` rifiuta un `content.js` che contenga `import`/`export`: il
  packaging rotto non può più passare senza browser.

**Correzioni alla pipeline di verifica**

- `pnpm check` ora include `format:check`, `verify-dist`, `check-size` e
  `check-links`: coincide con i controlli della CI, così un controllo non può
  più essere dato per superato in locale e fallire in remoto. In precedenza
  `format:check` falliva sulla CI da diversi cicli senza che fosse noto.
- Browser di test e2e spostato su **Chrome for Testing 155.0.8059.12**: il vecchio
  bucket dei snapshot Chromium non pubblica più build per Linux, e la CI falliva
  in fase di installazione. Verificato che `--load-extension` funzioni con questa
  build (il service worker si registra).

## 0.8.0 (2026-09-28) — Auto-lock, iframe, sicurezza

Settimo loop: auto-lock della chiave di sessione, due nuovi tool, tre difetti
di sicurezza corretti in red-team. 294 test.

**Auto-lock chiave di sessione**

- Nuova impostazione "Blocco automatico chiave": dopo 5/15/30/60 minuti di
  **inattività** le chiavi in session storage vengono cancellate.
- Default 0 (mai): cambia comportamento solo se lo attivi tu.
- L'attività è tracciata dal pannello (throttled, 1 messaggio ogni 30s) e
  confrontata con l'alarm: non è un timer fisso, si blocca quando lasci
  davvero l'estensione. Un run in corso non viene mai interrupt.
- **Agisce solo su `storage.session`**: se hai "Ricorda la chiave" attivo la
  chiave vive in local e non viene toccata, perché quella è una tua scelta.

**Nuovi tool (24 → 26)**

- `browser_iframe_snapshot`: elementi dentro un iframe stesso-origin; su
  cross-origin dice cosa fare invece (nessun tentativo di aggiramento).
- `browser_download`: avvia il download di un link, senza permessi aggiuntivi.

**Sicurezza (difetti trovati in red-team)**

- `browser_download` chiede ora conferma con policy "Azioni sensibili": prima
  scaricava file senza approvazione.
- `browser_iframe_snapshot` è classificato sola lettura: mai conferma, nemmeno
  con la policy più restrittiva.
- Corretta la regressione che allegava uno snapshot della pagina principale
  dopo lo snapshot iframe, invalidando i ref appena ottenuti.
- `browser_clipboard_read` ora chiede conferma anche con la policy predefinita:
  la documentazione lo dichiarava già, ma il codice non lo applicava.

**Altro**

- Stima dei token del task prima di avviarlo, con avviso se supera metà budget.
- Avviso se il modello digitato non è nella lista models del provider.
- Ricerca testuale nel log, combinabile con i filtri per tipo.
- Test sui tool browser (`src/background/tools.test.ts`), prima assenti.

## 0.7.0 (2026-09-17) — Leggero, con coda e discovery

Sesto loop da 100 migliorie (gigiloop): service worker −71%, model discovery,
coda task, nuovi tool, export log markdown, hint rotazione chiave.

**Performance**

- Ogni package provider è importato dinamicamente: il service worker carica
  SOLO il chunk del provider configurato. **background.js: 1.094.697 → 325.039 byte**.

**Nuovo**

- **Model discovery**: bottone ⟳ nel campo modello → lista modelli live dal
  provider (OpenAI-compatibili), cache locale con cap 500.
- **Coda task**: quando un task è in esecuzione, "Metti in coda" aggiunge il
  prossimo (max 5); parte in sequenza a fine run, mai dopo STOP esplicito.
- **Nuovi tool (21 → 24)**: `browser_hover` (menu/tooltip),
  `browser_clipboard_write`, `browser_clipboard_read` (la lettura degli appunti
  chiede conferma: può contenere dati personali).
  Drag sintetico saltato: inaffidabile con framework (decisione documentata).
- **Export log markdown**: header con data/provider/modello (mai la chiave).
- **Hint rotazione chiave**: se la chiave è stata salvata > 90gg, suggerimento
  locale (nessun dato inviato).
- Esc chiude le impostazioni; badge versione con indicatore bridge opencode.

## 0.6.0 (2026-09-16) — Provider planet + opencode

Quinto loop da 100 migliorie (gigiloop): 25 provider LLM, keystore per-provider,
integrazione opencode via native bridge.

**Provider (13 → 25)**

- Nuovi: NVIDIA NIM, OpenCode Zen, Cohere, DeepInfra, Fireworks, Perplexity,
  Together AI, Hugging Face, GitHub Models, Vercel AI Gateway, Baseten, SambaNova.
- Catalogo con gruppi (Cloud / Gateway / Locali) e `<optgroup>` nella select.
- Keystore per-provider (`lmuse.keys.v2`): ogni provider ha la sua chiave,
  migrazione lazy automatica dalla chiave singola v1.

**Integrazione opencode**

- Provider "OpenCode Zen" (gateway opencode.ai/zen, OpenAI-compatibile).
- Native bridge `pnpm setup:opencode` (+ `--uninstall`): legge
  `~/.local/share/opencode/auth.json`, mai rete, mai log di segreti.
- Card opencode nel pannello: Rileva / Importa chiavi (mappa opencode → lmuse).
- Errori in italiano per bridge mancante, auth.json assente/invalido.

**Qualità**

- 232 test (+33), coverage shared > 93% linee, e2e Chromium 7/7.
- Manifest: permesso `nativeMessaging` (solo per il bridge opencode, opt-in).

## 0.5.0 (2026-09-16) — Live e programmati

Quarto loop da 100 migliorie (gigiloop): streaming, task programmati, find/table/query,
shadow DOM, run history, import/export profilo, e2e con a11y.

**Live e controllo costi**

- Streaming della risposta nel pannello (bolla live, niente persistenza).
- Stop-text ("fermati quando vedi X") con chiusura graceful; token-guard per run.
- Composer con contatore, focus automatico a fine run, log compatto, suono opzionale.

**Nuovi tool (18 → 21)**

- `browser_find` (highlight + conteggio), `browser_table` (markdown),
  `browser_query` (selettori CSS → ref); `read_text` con mode main; snapshot che
  attraversa gli shadow DOM; circuit breaker e badge passi.

**Programmati e memoria**

- Task programmati (ogni 1h–7gg, max 5) via `chrome.alarms`, con next-run label,
  fast-deny delle approval senza panel, run history (ultimi 10).
- Import/export profilo JSON validato (mai la chiave); template e preset invariati.

**Qualità**

- 199 test, e2e con axe (fix contrasto reale), check età pin Chromium,
  no-remote-code in CI, CONTRIBUTING + STORE listing draft.

## 0.4.0 (2026-09-16) — Nuovi tool e fiducia

Terzo loop da 100 migliorie (gigiloop): 18 tool browser, health-check, trusted domains,
template/preset, e2e smoke, log UX.

**Tool browser (da 9 a 18)**

- `browser_select` (menu a tendina), `browser_wait` (testo/selettore, max 30s),
  `browser_press` (solo tasti navigazione, mai Invio), `browser_reload`,
  `browser_forward`, `browser_read_text` (redatto), `browser_links` (cap 200),
  `browser_tab_duplicate`, `browser_screenshot_element` (crop locale).
- Auto-snapshot dopo ogni azione; circuit breaker dopo 5 errori consecutivi.

**Fiducia e controllo**

- Trusted domains (ricorda dal banner approval), approval timeout configurabile,
  test connessione provider dal pannello, badge con conteggio passi.
- Template task salvati, preset Veloce/Preciso/Locale, tema auto/dark/light,
  lingua it/en, filtro log, export log, voci collassabili.

**Qualità**

- 176 test, e2e smoke su Chromium reale (anche in CI), coverage in CI,
  check-links, issue/PR template, Dependabot.

## 0.3.0 (2026-09-16) — Approval umana e minimizzazione

Secondo loop da 100 migliorie (gigiloop): human-in-the-loop, content script on-demand,
resilienza run, trasparenza costi, suite a 112 test.

**Sicurezza**

- Approval umana per azioni sensibili: policy off/sensitive (default)/all, safety floor
  per l'invio form, timeout 120s → negata, STOP sblocca le attese, decisioni nel log.
- Content script iniettato on-demand (via `content_scripts` statico) + sender check.
- Navigate rifiuta URL con credenziali; tracking params strippati; cooldown 5s tra RUN;
  chiavi < 8 char rifiutate; CI con audit high + secret-scan.

**Privacy**

- Header snapshot redatto (token URL sempre, titolo con mask), opzione host-only
  (solo origin+path), `tabs_list` redatta, cronologia troncata + flag keepHistory,
  usage stats solo-conteggi, banner se redazione OFF.
- Nessun nuovo permesso (audit diff manifest).

**Robustezza / UX**

- Auto-snapshot dopo ogni azione, redirect segnalati, conferma caratteri digitati,
  % scroll, hint pagina vuota, run-state orfano con Riprova, DONE con token+tempo,
  banner approval con countdown, onboarding, toolbar log, statistiche in ⚙.

**Qualità**

- 112 test (jsdom per snapshot, fake-timers per timeout, storage mockati),
  coverage shared > 90%, check-size + verify-dist in CI/release, Dependabot, AGENTS.md.

## 0.2.0 (2026-09-15) — Hardening sicurezza & privacy

100 migliorie (loop gigiloop) su sicurezza, privacy, robustezza, qualità e docs.

**Sicurezza**

- CSP `extension_pages` nel manifest, `minimum_chrome_version` 116, permessi minimi rivisti.
- Verifica sender sulla Port, validazione zod dei messaggi, task max 4000 caratteri.
- Blocco URL `javascript:/data:/file:/chrome:*` + Web Store, allowlist domini opzionale.
- Password mai nello snapshot, digitazione nei password bloccata di default.
- Chiave API in storage separato (local/session), toggle "ricorda", cancella chiave,
  cancella-tutto con conferma; chiave mai loggata (audit).
- Budget tool-call per run, timeout content script 10s, timeout globale run, STOP anche
  da tastiera (`Ctrl/Cmd+Shift+X`).

**Privacy**

- Redazione PII di default (email, IBAN, carte, telefoni, token URL), toggle persistenti,
  sezione privacy dedicata, referrer `no-referrer`.
- Inbox risultato persistente, cronologia locale max 20, export impostazioni senza chiave,
  chiave mascherata con reveal. Nessuna telemetria (audit). `PRIVACY.md` dedicato.

**Robustezza / UX**

- Errori provider in italiano, ref scaduto con nuovo snapshot, reconnect Port con backoff,
  badge RUN, contatore passi, header provider+modello, spinner, banner errori, Ctrl+K,
  auto-scroll intelligente, chips, cronologia cliccabile, copia risultato, auto-resize,
  tema chiaro, stop prominente, banner inbox, i18n it/en, a11y (role=log, aria-label, focus).

**Qualità**

- Vitest (47 test: pii, urlGuard, errors, budget, settings), CI GitHub Actions, ESLint 9
  flat + react-hooks, Prettier, script `check` e `release`, versione 0.2.0 coerente.

## 0.1.0 — Scaffold iniziale

Estensione MV3 con ToolLoopAgent (AI SDK v7), 9 tool browser, 13 provider, side panel React.
