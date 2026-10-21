# Privacy — lmuse

## Privacy Gateway v0.9.0 (beta)

## LM-009 — coerenza della pagina durante la lettura

Le letture del DOM e gli snapshot sono legati alla scheda e alla destinazione autorizzate. Quando Chrome segnala un caricamento, un cambio URL o la chiusura della scheda mentre il content script prepara il risultato, LMuse lo scarta; una ricarica che torna sullo stesso URL non deve riutilizzare il consenso come se la pagina fosse immutata. Il blocco non cancella comunicazioni già avviate dalla pagina.

## LM-008 — URL vietati e consenso

Prima di mostrare un prompt di approvazione per navigare, LMuse scarta gli URL con protocolli speciali o pericolosi, credenziali nella destinazione, servizi di metadata cloud e pagine riservate. Un'allowlist vuota non elimina questo divieto: non viene richiesto il consenso umano per aprire un URL che il filtro considera vietato. Il blocco non rende sicuro qualsiasi link o redirect eseguito dentro una pagina: altre navigazioni e richieste di rete restano soggette ai controlli di host e ai limiti descritti in SECURITY.md.

## LM-001 — accessi host per scopo, porta e origin

I permessi Chrome alle pagine sono opzionali. Oltre alla conferma nativa, LMuse richiede una concessione locale con origin **comprensivo di porta** e scopo distinto (`site` per pagine, `provider` per API LLM). Un provider locale su porta 11434 non abilita la lettura di un sito su porta 3000, anche se Chrome raggruppa entrambe sotto `http://localhost/*`. I due permessi possono essere revocati separatamente dal pannello. I reindirizzamenti non autorizzati non vengono letti, ma la navigazione HTTP può avere già provocato richieste di rete prima del rilevamento. I siti approvati possono comunque inviare dati al provider in forma non completamente anonimizzata.

Nella modalità **rigorosa** predefinita, l'utente imposta i domini consentiti e autorizza la prima lettura di ogni origin in ciascun run. Il service worker sostituisce email, telefoni, IBAN, carte, alcuni token e parametri segreti degli URL con segnaposto casuali prima di trasmettere i risultati dei tool al modello. La mappa reversibile rimane **solo in RAM durante il run**, senza export o persistenza: le risposte finali sono ripristinate localmente. Un token può essere risolto dentro la pagina soltanto nello stesso origin in cui è stato osservato e dopo l'approvazione dell'azione.

Screenshot disattivati nelle modalità protette, chiavi di sessione e cronologia disattivata per impostazione predefinita, task non presidiati bloccati in modalità rigorosa. La chiave di accesso al provider resta comunque visibile **al provider scelto** per l'autenticazione. Il testo libero, i nomi e altri dati non riconosciuti possono essere inviati o dedotti; pseudonimizzazione non significa anonimato garantito. Non esiste attualmente parsing anonimo di PDF/DOCX/XLSX o OCR integrato. Per perimetro e limiti consulta **[PRIVACY-GATEWAY.md](PRIVACY-GATEWAY.md)**.

lmuse è progettata per minimizzare i dati: **nessuna telemetria, nessun server nostro,
nessun account**. Tutto resta sul tuo PC tranne ciò che invii al provider LLM che scegli.

## Novità privacy v0.5.0

- **Task programmati**: task e cadenza restano locali; il run schedulato invia al
  provider solo ciò che invierebbe un run manuale.
- **Import/export profilo**: file JSON locale, validato (max 100KB), mai la chiave.
- **Run history**: ultimi 10 run (task troncato 200ch), cancellabile, solo locale.
- **Marks di find**: solo evidenziazione visiva temporanea, nessun dato raccolto.
- **Streaming**: i delta vivono solo in memoria del pannello, mai salvati.
- **Stop-text e token-guard**: valutati in locale, nessun dato in più al provider.

## Cosa viene inviato al provider LLM

Quando avvii un task, al provider scelto (es. OpenAI, Anthropic, Ollama in locale) vengono inviati:

- il testo del tuo task;
- lo **snapshot della pagina** (URL, titolo, elenco degli elementi interattivi);
- gli **screenshot** della pagina visibile, solo se il toggle è attivo (default ON);
- la cronologia dei passi del task in corso (contesto della conversazione agente).

Di default lo snapshot è **redatto**: email → `[email]`, IBAN → `[iban]`, carte → `[carta]`,
numeri di telefono e sequenze di 7+ cifre → `[numero]`, token/secret nei query param degli
URL → `[redatto]` (questi ultimi sempre, anche con redazione OFF). I valori dei campi
password **non escono mai** dalla pagina (solo marker `[password]`). Puoi disattivare la
redazione nelle impostazioni, ma è sconsigliato: un banner te lo ricorda finché è OFF.

### «Solo dominio» vale davunque ovunque

Con `privacyHostOnly` l'URL inviato è **solo origin+path**, senza query string: si
levano così i parametri che spesso contengono identificatori di sessione. La
regola si applica a **tutti** i percorsi che mostrano un URL al modello, non solo
all'intestazione dello snapshot: href dei link, URL dei tab aperti, URL dell'iframe.
Prima la valeva solo nell'intestazione, e le query string degli href e dei tab
arrivavano comunque al provider.

### Gli appunti non finiscono nel log

Gli appunti della pagina sono un dato sensibile, e restano tali anche quando
l'utente autorizza una lettura:

- il testo passato a `browser_clipboard_write` **non** viene registrato nei
  passi del task: nel log finisce solo quanti caratteri sono stati copiati;
- il testo letto con `browser_clipboard_read` **non** finisce nel log dei passi
  né nel file `.md` che esporti: nel log c'è solo la conferma che la lettura è
  avvenuta. Il contenuto arriva al modello solo nella risposta del tool, che è
  ciò che serve per decidere il passo successivo.

## Dove finiscono i tuoi dati (solo locale)

| Chiave `chrome.storage` | Dove            | Cosa contiene                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------------- |
| `lmuse.settings.v1`     | local (PC)      | provider, modello, limiti, approval, trusted, template, schedule, history run |
| `lmuse.key.v1`          | local o session | chiave API legacy (v→0.5.x, migrata in v2)                                    |
| `lmuse.keys.v2`         | local o session | **chiavi API per provider** (mappa providerId → chiave)                       |
| `lmuse.history.v1`      | local (PC)      | ultimi 20 task (max 200 char), cancellabile o OFF                             |
| `lmuse.inbox.v1`        | session (RAM)   | risultato dell'ultimo run (mai il task), svuotabile                           |
| `lmuse.usage.v1`        | local (PC)      | solo conteggi: run e token, nessun contenuto                                  |
| `lmuse.runstate.v1`     | session (RAM)   | task corrente (per rilevare restart), auto-pulito                             |
| `lmuse.onboarded.v1`    | local (PC)      | flag welcome mostrato                                                         |

La **chiave API non vive nelle impostazioni**: è in `lmuse.keys.v2`, una mappa
provider→chiave (ogni provider la sua). Con "Ricorda la chiave" attivo sta in
`chrome.storage.local`; spento, in `chrome.storage.session` (cancellata alla chiusura
di Chrome). Nel pannello è mascherata con reveal su richiesta (mai nel DOM in chiaro
altrimenti). La vecchia chiave singola `lmuse.key.v1` viene migrata automaticamente
nel record del provider in uso alla prima lettura.
"**Cancella tutti i dati**" (⚙, con conferma) svuota chiavi, impostazioni, cronologia,
inbox, statistiche uso e flag onboarding.

### Blocco automatico della chiave (v0.8.0)

L'opzione "Blocco automatico chiave" cancella le chiavi dopo 5/15/30/60 minuti di
**inattività**. Per capire l'inattività, lmuse registra solo un orario
(`lmuse.activity.v1`, in `chrome.storage.session`): non sa cosa stai facendo, non
sa quali pagine visiti, non registra nulla di personale. L'orologio viene azzerato
a ogni interazione col pannello e non viene inviato ad alcun server.

Due limiti da conoscere:

- **Riguarda solo `storage.session`.** Se "Ricorda la chiave" è attivo, la chiave
  sta in `chrome.storage.local` e l'auto-lock non la tocca: ricordarla è una tua
  scelta esplicita. Per proteggere anche quella chiave usa "Cancella chiave" o
  disattiva "Ricorda la chiave".
- **Non è un timer fisso.** Se stai usando l'estensione, il blocco non scatta; se
  un task è in esecuzione, il blocco attende che finisca.

## Bridge opencode (opt-in, solo se installato da te)

Se esegui `pnpm setup:opencode`, l'estensione può chiedere al native host
`native/lmuse-opencode-bridge.mjs` (solo stdio, **nessuna rete**) di leggere
`~/.local/share/opencode/auth.json` e restituire: (a) l'elenco dei provider
configurati (nomi, mai chiavi) e (b) — solo su click "_Importa chiavi_" — le chiavi
dei provider che lmuse supporta. Nulla viene inviato a terzi; permesso richiesto:
`nativeMessaging`. Disinstalla con `pnpm setup:opencode --uninstall`.

## Novità privacy v0.4.0

- **Trusted domains**: solo hostname, max 50, solo locali; niente navigazione autonoma
  in più, solo meno conferme dove hai già deciso tu.
- **Template task**: testi tuoi, max 20×300 char, solo locali.
- **Health-check**: "Prova connessione" invia al provider solo il probe "Reply with
  exactly: OK" (nessun dato tuo).
- **Host tab attivo** mostrato nel pannello (solo lettura locale, mai inviato altrove).
- **Screenshot elemento**: ritagliato in locale prima dell'invio (meno pixel al modello).
- **Export log**: download di un file locale, nessun upload.

## Novità privacy v0.3.0

- **Approval umana**: prima di navigare domini nuovi, inviare form o cambiare tab,
  l'agente chiede conferma nel pannello (policy configurabile, default sensibili).
- **Iniezione on-demand**: il content script non è più iniettato all'apertura delle
  pagine, solo quando il task agisce davvero sul tab.
- **Meno dati in giro**: tracking params (`utm_*`, `gclid`, …) rimossi prima di navigare;
  URL con credenziali rifiutati; `tabs_list` redatta come gli snapshot.

## Cosa lmuse NON fa

- Nessuna telemetria, analytics, crash-report o chiamata di rete oltre al provider scelto
  (verifica: nessun `fetch`/`XHR`/`sendBeacon` nel codice, solo gli SDK dei provider).
- Nessun cookie o credenziale inviato manualmente; niente `localStorage`/`cookie` di pagina letto.
- Il content script non legge né esporta nulla di suo: agisce solo su richiesta del task
  (snapshot/click/digitazione/scroll) e non gira negli iframe (`all_frames: false`).
- Nelle pagine `chrome://`, Web Store ed interne il content script non può girare:
  l'agente lo segnala invece di fallire in silenzio.
- `host_permissions: <all_urls>` serve perché l'agente deve poter lavorare su qualsiasi sito
  che gli chiedi; non c'è navigazione autonoma fuori dai domini che consenti (allowlist
  opzionale nelle impostazioni). Alternativa futura: `optional_host_permissions` con consenso
  per-sito (vedi roadmap in GUIDA.md).

## Esportazione

"Esporta impostazioni" copia negli appunti un JSON **senza chiave API**.

# LM-001 — permessi host opzionali

L'accesso alle pagine web e alle API dei fornitori di modelli è ora richiesto per dominio dal pannello tramite il consenso nativo di Chrome; l'installazione non richiede più il permesso globale `<all_urls>`. Il semplice inserimento di un dominio nella whitelist non conferisce un permesso. Si può revocare il sito dal pannello; la revoca non ritira dati già inviati al provider.
