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

| Permesso                    | Uso                                                                   | Alternativa valutata                                               |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `storage`                   | settings/chiave/cronologia locali                                     | nessuna (serve persistenza)                                        |
| `scripting`                 | inject on-demand di `content.js` (solo `files:`)                      | content script statico (peggio: sempre attivo)                     |
| `activeTab`                 | `captureVisibleTab` su richiesta e accesso temporaneo al tab corrente | Necessario senza `<all_urls>`; resta soggetto a privacy e consenso |
| `sidePanel`                 | pannello laterale                                                     | popup (peggiore per task lunghi)                                   |
| `alarms`                    | cadenza task programmati (solo locali)                                | polling dal panel (richiede panel aperto)                          |
| `nativeMessaging`           | bridge opencode (host registrato dall'utente)                         | nessuna; senza bridge il canale è chiuso                           |
| `optional_host_permissions` | Accesso al dominio solo dopo gesto e conferma Chrome                  | Nessun host globale install-time                                   |

### LM-004 — Riduzione dei metadati accessibili in Chrome

- Eliminato il permesso install-time `tabs`: l'estensione non può più leggere indiscriminatamente URL, titolo, `pendingUrl` e favicon delle schede non autorizzate.
- L'API `chrome.tabs` resta utilizzabile per elencare identificativi, attivare, creare e aggiornare le schede; il contenuto sensibile è visibile soltanto sugli host autorizzati. La policy LMuse richiede **anche** un grant applicativo esatto con ruolo `site`.
- `scripting` resta obbligatorio per `chrome.scripting.executeScript` (iniezione on-demand di `content.js` soltanto dopo verifica locale del dominio); `activeTab` è necessario alla cattura del tab visibile, che resta soggetta alle autorizzazioni e alle restrizioni privacy.
- E2E Chrome: i metadati devono essere assenti prima del grant, leggibili dopo il grant host e nuovamente assenti dopo la revoca.

### LM-001: autorizzazione Chrome distinta dall'allowlist

- Il campo **Domini consentiti** è soltanto un limite ulteriore impostato dall'utente; non conferisce permessi Chrome.
- In **Privacy** inserire l'URL completo del sito, premere **Autorizza questo sito in Chrome**, quindi autorizzare l'API del provider con il pulsante separato.
- Le match pattern Chrome includono solo schema e hostname e **ignorano la porta**. Per questo ogni concessione viene anche registrata localmente in `lmuse.hostGrants.v1` con **origin completo, porta e ruolo** (`site` oppure `provider`); i ruoli e le porte non sono intercambiabili.
- Prima delle operazioni l'agente verifica sia il registro app sia `chrome.permissions.contains`. Concedere un provider su `http://localhost:11434` non consente di leggere il sito `http://localhost:3000`, né lo stesso endpoint in ruolo `site`.
- I pulsanti **Revoca permesso sito** e **Revoca API del provider** eliminano il rispettivo ruolo locale. La match pattern Chrome viene rimossa soltanto quando nessun ruolo sullo stesso hostname la richiede; **Cancella tutto** rimuove anche i grant gestiti. La revoca non ritira dati già trasmessi.
- Dopo redirect, back/forward o click l'URL deve essere nuovamente autorizzato prima di leggerne il DOM. Un redirect può già aver avviato richieste di rete verso il sito di arrivo: l'estensione **non può garantire di impedirle**, ma rifiuta la lettura e segnala il confine violato anziché simulare uno snapshot riuscito.
- **Limitazione LM-002:** manca ancora un inventario visuale completo di tutte le autorizzazioni con revoca granulare da una lista. Non usare su profili produttivi finché il collaudo manuale non è chiuso.

### LM-007 — URL riservati e endpoint di rete

- Parsing URL rigoroso: esclusivamente HTTP(S) senza credenziali, con schema e host canonici; i protocolli interni o speciali del browser non sono navigabili né autorizzabili.
- Hard deny sugli endpoint noti di cloud instance metadata/credenziali (fra cui EC2/GCP/Azure/ECS/Alibaba e IP link-local), IP non specificati/broadcast e Web Store. I controlli si applicano sia a navigazione sia a `hostPattern`/`requireHostAccess` e alle API provider configurabili.
- `localhost`, indirizzi loopback, RFC1918 e host intranet non ricevono accesso automatico: devono ottenere un grant app esatto `origin+porta+ruolo` e il permesso Chrome corrispondente. Ollama/LM Studio restano disponibili solo tramite grant `provider`. Il pannello segnala visivamente l'uso di indirizzi privati.
- **Limiti:** il blocco statico non sostituisce risoluzione DNS affidabile, protezione da DNS rebinding, policy proxy/server o controllo degli eventuali redirect di rete effettuati prima dell'autorizzazione al DOM. LM-008/LM-009 proseguiranno questo hardening.

### LM-005 — revoca interrompe immediatamente i run

- Il service worker ascolta `chrome.storage.onChanged` sul registro host e rileva quando sparisce un'abilitazione precisa `origin + purpose`. Un nuovo grant o l'aggiornamento di un timestamp non causa interruzioni.
- Alla revoca di almeno un'abilitazione, un task attivo viene interrotto tramite `AbortController`, le approvazioni pendenti vengono negate e non vengono avviati automaticamente i task in coda.
- Ogni tool verifica il segnale di STOP prima di iniziare, prima di iniettare nuovamente un content script e **dopo** il completamento dell'operazione asincrona: i risultati ottenuti dopo la revoca non vengono restituiti al modello.
- Una richiesta o un click già eseguiti prima della revoca non possono essere annullati retroattivamente; la difesa ferma i passi successivi, non ripristina gli effetti precedenti.

### LM-006 — separazione dei profili Chrome

- Le autorizzazioni applicative, i secret locali, i risultati e la sessione sono associati al profilo Chrome che ospita LMuse. Il nuovo E2E usa due profili Chrome for Testing in directory temporanee, con lo stesso ID estensione, e richiede isolamento bidirezionale di impostazioni, chiavi sintetiche, origin grant e inbox.
- Le chiavi in \`chrome.storage.session\` e l'inbox devono sparire dopo la chiusura completa del browser; le chiavi esplicitamente persistenti in \`chrome.storage.local\` restano soltanto nel loro profilo. Il test controlla due riavvii indipendenti.
- **Confine distinto:** Native Messaging è registrato a livello di utente OS (HKCU su Windows), non di singolo profilo Chrome. Un utente che installa esplicitamente il bridge per un ID estensione autorizza tale ID nell'account OS: il bridge non può dedurre quale profilo Chrome abbia originato una richiesta. Non trattare i profili dello stesso account OS come un confine di sicurezza contro altri profili contenenti la stessa estensione; l'import credenziali resta una funzione esplicita del pannello. Per isolamento forte usare account OS distinti e non registrare il bridge nei profili non attendibili.

### Bridge opencode — superficie d'attacco

Il native host `it.lmuse.opencode_bridge` è registrato solo da te
(`pnpm setup:opencode --extension-id=<id>`) e risponde solo all'estensione con ID autorizzato in
`allowed_origins`. Il protocollo: messaggi JSON < 1 MiB con framing uint32LE,
comandi ammessi `ping`/`list`/`export` solo (ogni altro → rifiutato). La risposta
è validata con zod nel worker prima dell'uso. Le chiavi esportate non toccano
mai i log né la UI in chiaro (maschera con reveal). Non c'è scrittura su disco
dal bridge: solo lettura di `~/.local/share/opencode/auth.json`.

**LM-003 — installazione governata:** il setup rifiuta ID mancanti/non validi e
non scrive più un manifest con `<ID-ESTENSIONE>`. Installa una copia locale del
bridge e un launcher eseguibile (shell su macOS/Linux con bit `execute`; su
Windows piccolo EXE .NET compilato localmente con PowerShell). Il manifest
consente un solo `chrome-extension://<id>/` esplicito; su Windows le voci HKCU
sono create solo lanciando intenzionalmente il setup. La modalità `--dry-run`
crea file soltanto in una directory temporanea e non tocca Chrome/Edge o il registro.
I test eseguono il launcher vero con credenziali **sintetiche**, controllando
`ping`, `list`, `export`, framing e pinning senza accedere ad auth.json reale.
Su macOS/Linux, Chrome for Testing 146+ richiede una directory
`NativeMessagingHosts` distinta da Chrome Stable; il setup scrive entrambi
i manifest limitati al medesimo ID. La CI prova la chiamata effettiva da
Chrome for Testing con una home provvisoria e credenziali sintetiche.
La CI Windows esegue una prova separata su runner GitHub ospitato e temporaneo:
registra l'host solo nell'HKCU di quella macchina, avvia Chrome for Testing con
profilo nuovo e conferma il percorso reale Chrome → EXE .NET → Node, inclusi
pinning dell'estensione, risposte e disinstallazione. Lo script rifiuta
l'esecuzione su normali PC Windows, anche con un profilo Chrome temporaneo:
su Windows il registro Native Messaging è per utente, non per profilo Chrome.
Il launcher Windows inoltra i byte con flush su ogni blocco in entrata e uscita:
Chrome tiene aperto stdin mentre attende la risposta del native host, quindi
attendere EOF prima di svuotare il pipe causava un blocco reciproco. Un test
regressivo conserva stdin aperto fino alla ricezione del framing di risposta.
Il native bridge può esporre credenziali al pannello solo tramite il comando
`export`: trattare import e ambiente Chrome come operazioni sensibili.

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
