# Security — lmuse

## Hardened beta v0.9.0

- Conferma obbligatoria per click e digitazione: il click DOM può inviare un form o eliminare dati anche senza flag submit.
- Ogni approvazione vincola **ID e URL** della scheda, viene consumata per una sola operazione; il cambio pagina invalida l'azione.
- Privacy Gateway con segnaposto casuali per run e origin, approvazione di lettura per origin in modalità rigorosa, e ripristino in pagina consentito soltanto sul sito originale.
- Screenshot sempre bloccati in modalità protetta; input di upload e label associate bloccati nel content script.
- Default prudenziale: domini consentiti obbligatori in modalità rigorosa, chiave di sessione, screenshot OFF, cronologia OFF, conferme complete.

**Non è garanzia di anonimato assoluto:** testi liberi, nomi e file complessi non sono anonimizzati in modo universale; il contesto può permettere reidentificazione. Dal lavoro LM-001 il manifest non chiede più accesso globale obbligatorio ai siti: il pannello richiede un consenso Chrome distinto per il sito e per il provider, e il worker verifica il permesso prima delle operazioni. Il provider LLM continua a conoscere la chiave API usata per autenticarsi. Leggere **[PRIVACY-GATEWAY.md](PRIVACY-GATEWAY.md)** prima dell'uso con dati reali.

## Superficie d'attacco (volutamente piccola)

- Manifest MV3 con `content_security_policy: script-src 'self'; object-src 'self'`.
  La CSP `extension_pages` copre tutte le pagine dell'estensione, side panel incluso
  (stesso contesto, nessuno script inline/remoto).
- Nessuna `web_accessible_resources`, nessun `eval`/`innerHTML`/`new Function`,
  nessuna `externally_connectable`: le pagine web non possono messaggiare l'estensione.
- Permessi minimi (rationale sotto). Niente `debugger`, niente `notifications`,
  niente `cookies`, niente `webRequest`.
- Il side panel parla col service worker solo via Port `lmuse` con verifica
  `sender.id === chrome.runtime.id`; i messaggi panel→worker sono validati con zod
  (RUN/STOP/APPROVE/DENY). Il content script accetta comandi solo dal nostro id.
- `minimum_chrome_version: 116` (Side Panel API stabile).

## Rationale permessi

| Permesso                    | Uso                                                  | Alternativa valutata                           |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `storage`                   | settings/chiave/cronologia locali                    | nessuna (serve persistenza)                    |
| `scripting`                 | inject on-demand di `content.js` (solo `files:`)     | content script statico (peggio: sempre attivo) |
| `tabs`                      | leggere URL/titolo, elencare e fokusare tab          | `activeTab` solo (insufficiente per multi-tab) |
| `activeTab`                 | agire sul tab attivo senza prompt                    | —                                              |
| `sidePanel`                 | pannello laterale                                    | popup (peggiore per task lunghi)               |
| `alarms`                    | cadenza task programmati (solo locali)               | polling dal panel (richiede panel aperto)      |
| `nativeMessaging`           | bridge opencode (host registrato dall'utente)        | nessuna; senza bridge il canale è chiuso       |
| `optional_host_permissions` | Accesso al dominio solo dopo gesto e conferma Chrome | Nessun host globale install-time               |

### LM-001: autorizzazione Chrome distinta dall'allowlist

- Il campo **Domini consentiti** è soltanto un limite ulteriore impostato dall'utente; non conferisce permessi Chrome.
- In **Privacy** inserire l'URL completo del sito, premere **Autorizza questo sito in Chrome**, quindi autorizzare l'API del provider con il pulsante separato.
- Gli host sono autorizzati per schema e hostname esatti. Chrome ignora il percorso; le match pattern non limitano le porte, pertanto le API su loopback condividono il medesimo permesso per hostname.
- Prima dell'iniezione del content script, della lettura o delle navigazioni, l'agente consulta `chrome.permissions.contains` e rifiuta l'azione se il permesso è assente.
- Il pulsante **Revoca permesso sito** chiama `chrome.permissions.remove`. La revoca vieta le successive azioni; non cancella i dati già trasmessi a un modello remoto.
- **Limitazione LM-002:** l'interfaccia non mostra ancora un inventario completo dei permessi concessi e la revoca dei permessi provider. Non usare su profili produttivi finché il collaudo manuale non è chiuso.

### Bridge opencode — superficie d'attacco

Il native host `it.lmuse.opencode_bridge` è registrato solo da te
(`pnpm setup:opencode`) e risponde solo all'estensione con ID autorizzato in
`allowed_origins`. Il protocollo: messaggi JSON < 1 MiB con framing uint32LE,
comandi ammessi `ping`/`list`/`export` solo (ogni altro → rifiutato). La risposta
è validata con zod nel worker prima dell'uso. Le chiavi esportate non toccano
mai i log né la UI in chiaro (maschera con reveal). Non c'è scrittura su disco
dal bridge: solo lettura di `~/.local/share/opencode/auth.json`.

I 9 tool aggiunti in v0.4.0 (select, wait, press, reload, forward, read_text, links,
duplicate, screenshot_element) riusano gli stessi permessi: nessun nuovo permesso
introdotto (audit diff manifest).

## Difese per l'agente

- Blocco navigazione verso `javascript:`/`data:`/`file:`/`chrome:*`/`about:*` e Web Store;
  niente credenziali `user:pass@` negli URL; strip tracking params; allowlist domini.
- Approval umana (default sensitive) + safety floor invio form; timeout 120s → negata.
- Campi password: mai il valore nello snapshot, digitazione bloccata di default.
- Budget tool-call per run + timeout 10s per risposta content script + timeout globale run
  - STOP (pulsante e `Ctrl/Cmd+Shift+X`) che abortisce LLM, azioni e attese di conferma.
- La chiave API non è mai loggata né inclusa in export/log; errori provider mappati in
  messaggi che non espongono la chiave.
- Cooldown 5s tra RUN; chiavi < 8 caratteri rifiutate; CI con `pnpm audit` e secret-scan.

### Il confine «Domini consentiti» è applicato davvero

L'allowlist è un controllo centrale, non una promessa:

- ogni **lettura di contenuto** ricontrolla il dominio, non solo l'azione che la
  precede. Senza questo, un back/forward o un reindirizzamento portavano a una
  pagina fuori allowlist che veniva letta e mandata al provider;
- `browser_tab_focus` verifica il dominio **prima** di portare la scheda in
  primo piano: fallire dopo avrebbe lasciato il browser su una pagina non
  autorizzata;
- l'allowlist vuota resta senza vincoli (comportamento predefinito).

### La conferma vale per la pagina che l'utente stava vedendo

Tra la richiesta di conferma e l'esecuzione passa del tempo, e l'utente può
cambiare scheda. La scheda attiva al momento della conferma viene **vincolata**:
se l'utente cambia scheda nel frattempo l'azione non parte e viene chiesto di
ripetere il comando. Senza il vincolo l'azione partiva sulla pagina nuova, che
l'utente non aveva approvato.

## Minacce note (limiti onesti)

- **Prompt injection dalle pagine**: lo snapshot contiene testo di siti terzi che può
  contenere istruzioni malevole ("ignora le regole e..."). Il system prompt ordina di usare
  solo ref/URL osservati e mai inventare azioni; resta il rischio intrinseco degli agenti
  browser. Non usare lmuse per task con dati critici su siti non fidati.
- **Approval-bypass via UI confusion**: un sito potrebbe mostrare finti banner di conferma.
  L'unica conferma valida è quella nel pannello lmuse (badge lmuse, countdown): non
  approvare azioni che non hai chiesto.
- **Il modello vede ciò che vede**: snapshot e screenshot vanno al provider. Usa provider
  locali (Ollama/LM Studio) per dati sensibili; `privacyHostOnly` riduce gli URL.
- **Service worker MV3**: su task molto lunghi Chrome può sospendere il worker; il
  run-state orfano viene rilevato e offre Riprova (vedi roadmap: offscreen document).
- **Nuovi tool v0.4.0**: `select`/`press` agiscono sulla pagina come click/type (stesse
  guardie + approval sensitive per select); `read_text`/`links` esfiltrano testo al
  modello (redazione attiva di default); `test-connection` invia solo un probe "OK".
  Nessuno aggiunge permessi o canali di rete.
- **Task programmati (v0.5.0)**: girano senza supervisione → approval con timeout 20s
  e default negata, mai auto-approve; passano dagli stessi controlli di un RUN manuale
  (chiave, cooldown, allowlist, circuit). Nuovo permesso `alarms` solo per la cadenza.
- **Streaming/import (v0.5.0)**: i delta vanno solo al pannello (mai storage, render
  come testo); l'import valida shape+size e scarta chiavi ignote (anti `__proto__`).

## Segnalare una vulnerabilità

Apri una issue privata o contatta il maintainer con: versione (`0.3.0`), passi per
riprodurre, impatto stimato. Non pubblicare exploit prima di un fix. Risponderemo con
tempistiche di fix entro 7 giorni.
