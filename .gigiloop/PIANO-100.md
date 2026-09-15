# Piano 100 migliorie — lmuse (GigiLoop)

Ogni voce corrisponde a una modifica reale verificabile. [x] = applicata e verificata.
Tipi: [code] modifica codice, [audit] verifica con comando/grep + documento.

## Sicurezza (S01–S25)

- [x] S01 [code] CSP esplicita `extension_pages` nel manifest (script-src/object-src 'self')
- [x] S02 [audit] Nessuna `web_accessible_resources`: nessuna risorsa esposta a pagine web
- [x] S03 [code] Verifica `sender.id === chrome.runtime.id` su Port (anti-iniezione da altre estensioni)
- [x] S04 [code] Validazione zod di tutti i messaggi panel→worker (RUN/STOP) con limiti
- [x] S05 [code] Task max 4000 caratteri, trim e validazione input
- [x] S06 [code] urlGuard: blocco protocolli javascript:/data:/file:/chrome*/about:/edge e Web Store nel tool navigate
- [x] S07 [code] Allowlist domini opzionale (impostazione) per limitare la navigazione dell'agente
- [x] S08 [code] Campi password nello snapshot: mai il valore, solo marker [password]
- [x] S09 [code] Blocco digitazione in campi password quando la privacy è attiva
- [x] S10 [code] Redazione PII nello snapshot: email, IBAN, carte, numeri (maskPii)
- [x] S11 [code] Redazione token segreti negli URL (token/key/auth/secret/session/code)
- [x] S12 [code] Budget tool-call per run (guardia centrale defineTool + classe ToolBudget testata)
- [x] S13 [code] Timeout 10s per ogni risposta content script (Promise.race)
- [x] S14 [code] Timeout globale run configurabile (default 15 min) con abort
- [x] S15 [code] STOP interrompe LLM e azioni in corso (abort propagation)
- [x] S16 [code] Comando tastiera per STOP (Ctrl/Cmd+Shift+X) nel manifest
- [x] S17 [audit] Mai loggare la chiave API: grep su console/log e rimozione riferimenti
- [x] S18 [code] Chiave API in storage separato con modalità "solo sessione" (chrome.storage.session)
- [x] S19 [code] Toggle "ricorda chiave" + pulsante "cancella chiave"
- [x] S20 [code] Pulsante "cancella tutti i dati" con conferma (settings+chiave+cronologia+inbox)
- [x] S21 [code] Toggle invio screenshot on/off + errore esplicito se disattivato
- [x] S22 [code] Toggle maschera PII on/off persistente (default ON)
- [x] S23 [code] Meta referrer no-referrer nel sidepanel HTML
- [x] S24 [code] minimum_chrome_version 116 e revisione permessi minimi (niente debugger/notifications)
- [x] S25 [audit] Nessun innerHTML/eval/dangerouslySetInnerHTML + minacce documentate

## Privacy (P26–P45)

- [x] P26 [code] PRIVACY.md completo (dati trattati, dove finiscono, nessuna telemetria)
- [x] P27 [audit] Nessuna telemetria: le richieste vanno solo al provider scelto
- [x] P28 [code] Header OpenRouter (HTTP-Referer/X-Title) neutrali, niente dati identificativi falsi
- [x] P29 [code] Inbox persistente: risultato dell'ultimo run salvato localmente e leggibile dopo chiusura
- [x] P30 [code] Cronologia task locale (max 20, dedup) con cancellazione singola e totale
- [x] P31 [audit] Il content script non legge/esporta nulla di suo: solo azioni su richiesta
- [x] P32 [code] Snapshot ridatto di default (flag privacy default ON)
- [x] P33 [code] Sezione privacy dedicata nel pannello impostazioni
- [x] P34 [code] Export impostazioni (JSON senza chiave) negli appunti
- [x] P35 [code] Chiave mascherata con reveal toggle
- [x] P36 [audit] Elenco chiavi chrome.storage usate, documentato in PRIVACY.md
- [x] P37 [audit] Nessun cookie/credenziale inviato manualmente (audit fetch)
- [x] P38 [audit] host_permissions <all_urls> documentato + alternativa optional host descritta
- [x] P39 [audit] all_frames:false confermato (no iframe)
- [x] P40 [audit] Nessun log del contenuto pagine in console
- [x] P41 [code] Pagine chrome:// senza content script: messaggio utente chiaro
- [x] P42 [code] Inbox consumabile ("segna letto") dall'utente
- [x] P43 [code] Maschera PII applicata anche ai messaggi STEP mostrati nel panel
- [x] P44 [audit] localStorage di pagina mai usato
- [x] P45 [code] GUIDA: sezione "Cosa vede il modello"

## Robustezza (R46–R70)

- [x] R46 [code] Mappa errori provider → messaggi italiani (401/403/429/timeout/5xx)
- [x] R47 [code] Errori AI SDK gestiti esplicitamente (APICallError, abort, timeout)
- [x] R48 [code] Ref scaduto: click/type allegano un nuovo snapshot invece di errore secco
- [x] R49 [code] Messaggio chiaro su pagine senza content script con cause possibili
- [x] R50 [code] Il run prosegue anche se il panel si chiude (risultato in inbox)
- [x] R51 [code] Riconnessione automatica Port panel↔worker con backoff
- [x] R52 [code] Broadcast difensivo: porta morta rimossa senza crash
- [x] R53 [code] Clamping maxSteps (3–100) e runTimeoutMin (1–120) lato salvataggio (sanitizeSettings)
- [x] R54 [code] Retry LLM configurabile (maxRetries, default 2)
- [x] R55 [code] Doppio RUN gestito con errore esplicito
- [x] R56 [code] Listener SW async-safe: sendResponse una sola volta, try/catch totale
- [x] R57 [code] Content script: switch esclusivo su kind validato + range check ref
- [x] R58 [code] Truncature snapshot centralizzate
- [x] R59 [code] waitForTabComplete con timeout e cleanup timer garantito
- [x] R60 [code] navigate: attesa caricamento + settle e gestione errori snapshot
- [x] R61 [code] i18n: stringhe UI centralizzate (shared/i18n.ts, it+en)
- [x] R62 [code] A11y: aria-label sui bottoni, role="log" sull'area messaggi
- [x] R63 [code] A11y: focus textarea all'apertura, title su icone
- [x] R64 [code] Badge icona "RUN" durante l'esecuzione
- [x] R65 [code] Contatore passi attuali/max nel composer
- [x] R66 [code] Header mostra provider+modello attivi
- [x] R67 [code] Spinner "in esecuzione" animato
- [x] R68 [code] Banner errori dismissabile oltre al log
- [x] R69 [code] Scorciatoia Ctrl/Cmd+K per focus sul task
- [x] R70 [code] Auto-scroll log intelligente (solo se già in fondo)

## Qualità (Q71–Q80)

- [x] Q71 [code] Test vitest: pii, urlGuard, errors, budget, settings
- [x] Q72 [code] vitest.config.ts + script `test`
- [x] Q73 [code] Campo packageManager (pnpm@9) per riproducibilità
- [x] Q74 [code] GitHub Actions CI: typecheck + test + build
- [x] Q75 [code] eslint 9 flat config + script `lint`
- [x] Q76 [code] prettier + script `format` + formattazione applicata
- [x] Q77 [code] Script `check` combinato (typecheck+test+build)
- [x] Q78 [code] Script `release`: zip di dist/ pronto per il Web Store
- [x] Q79 [code] Versione 0.2.0 coerente package/manifest
- [x] Q80 [code] chunkSizeWarningLimit configurato (niente warning build fuorviante)

## Documentazione (D81–D90)

- [x] D81 [code] GUIDA: sezione Sicurezza & Privacy implementata
- [x] D82 [code] GUIDA: diagramma flusso aggiornato
- [x] D83 [code] GUIDA: FAQ (perché niente debugger permission, chrome:// ecc.)
- [x] D84 [code] README aggiornato (stato, test, CI)
- [x] D85 [code] SECURITY.md (come segnalare vulnerabilità)
- [x] D86 [code] CHANGELOG.md 0.2.0
- [x] D87 [code] LICENSE MIT
- [x] D88 [code] GUIDA: tabella comandi tastiera
- [x] D89 [code] Commenti architetturali aggiornati al nuovo codice
- [x] D90 [code] GUIDA: sezione test & CI

## UX (U91–U100)

- [x] U91 [code] Chips prompt suggeriti quando il log è vuoto
- [x] U92 [code] Cronologia task cliccabile (riprende il testo)
- [x] U93 [code] Copy risultato finale negli appunti
- [x] U94 [code] Auto-resize textarea
- [x] U95 [code] Tema chiaro via prefers-color-scheme
- [x] U96 [code] Pulsante stop più evidente durante il run
- [x] U97 [code] Banner inbox "risultato pronto" dopo riapertura
- [x] U98 [code] Cambio provider: default modello/base URL coerenti (fix placeholder)
- [x] U99 [code] Avvia disabilitato senza chiave + CTA che apre le impostazioni
- [x] U100 [code] Transizioni CSS sottili su messaggi e pannello

## Report finale

(viene aggiornato alla fine della loop)

## Report finale

- 100/100 voci applicate e verificate (2026-09-15/16).
- `pnpm check` verde: typecheck + 47/47 test vitest + build.
- `pnpm lint` (ESLint 9 flat + react-hooks) e Prettier verdi.
- `pnpm release` produce `release/lmuse-0.2.0.zip` (362 KB).
- Audit grep: zero `console.log`, zero sink XSS, zero fetch/XHR/beacon manuali,
  zero web storage di pagina, nessuna `web_accessible_resources`, chiave solo in
  memoria/storage separato.
- Fix reali emersi: regex telefoni (privacy), timer withTimeout (leak), tipizzazione
  `tool()` AI SDK v7, downgrade TS 7→5.9 per typescript-eslint.
- Rischi residui documentati in SECURITY.md (prompt injection, `<all_urls>`, worker MV3).
