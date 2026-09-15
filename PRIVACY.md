# Privacy — lmuse

lmuse è progettata per minimizzare i dati: **nessuna telemetria, nessun server nostro,
nessun account**. Tutto resta sul tuo PC tranne ciò che invii al provider LLM che scegli.

## Cosa viene inviato al provider LLM

Quando avvii un task, al provider scelto (es. OpenAI, Anthropic, Ollama in locale) vengono inviati:

- il testo del tuo task;
- lo **snapshot della pagina** (URL, titolo, elenco degli elementi interattivi);
- gli **screenshot** della pagina visibile, solo se il toggle è attivo (default ON);
- la cronologia dei passi del task in corso (contesto della conversazione agente).

Di default lo snapshot è **redatto**: email → `[email]`, IBAN → `[iban]`, carte → `[carta]`,
numeri di telefono e sequenze di 7+ cifre → `[numero]`, token/secret nei query param degli
URL → `[redatto]`. I valori dei campi password **non escono mai** dalla pagina (solo marker
`[password]`). Puoi disattivare la redazione nelle impostazioni, ma è sconsigliato.

## Dove finiscono i tuoi dati (solo locale)

| Chiave `chrome.storage` | Dove            | Cosa contiene                           |
| ----------------------- | --------------- | --------------------------------------- |
| `lmuse.settings.v1`     | local (PC)      | provider, modello, flag privacy, limiti |
| `lmuse.key.v1`          | local o session | **chiave API** (vedi sotto)             |
| `lmuse.history.v1`      | local (PC)      | ultimi 20 task (testo), cancellabile    |
| `lmuse.inbox.v1`        | session (RAM)   | risultato dell'ultimo run, svuotabile   |

La **chiave API non vive nelle impostazioni**: è in un record separato. Con "Ricorda la
chiave" attivo sta in `chrome.storage.local`; spento, in `chrome.storage.session`
(cancellata alla chiusura di Chrome). Nel pannello è mascherata con reveal su richiesta.
"**Cancella tutti i dati**" (⚙, con conferma) svuota chiave, impostazioni, cronologia e inbox.

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
