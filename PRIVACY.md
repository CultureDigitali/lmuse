# Privacy — lmuse

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
Con `privacyHostOnly` l'URL inviato è solo origin+path (niente query string).

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

## Bridge opencode (opt-in, solo se installato da te)

Se esegui `pnpm setup:opencode`, l'estensione può chiedere al native host
`native/lmuse-opencode-bridge.mjs` (solo stdio, **nessuna rete**) di leggere
`~/.local/share/opencode/auth.json` e restituire: (a) l'elenco dei provider
configurati (nomi, mai chiavi) e (b) — solo su click "*Importa chiavi*" — le chiavi
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
