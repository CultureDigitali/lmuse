# Security — lmuse

## Superficie d'attacco (volutamente piccola)

- Manifest MV3 con `content_security_policy: script-src 'self'; object-src 'self'`,
  nessuna `web_accessible_resources`, nessun `eval`/`innerHTML`/`new Function`.
- Permessi minimi: `storage`, `scripting`, `tabs`, `activeTab`, `sidePanel` (+ host per
  operare sui siti). Niente `debugger` (niente controllo DevTools), niente `notifications`,
  niente `cookies`, niente `webRequest`.
- Il side panel parla col service worker solo via Port `lmuse` con verifica
  `sender.id === chrome.runtime.id`; i messaggi panel→worker sono validati con zod.
- `minimum_chrome_version: 116` (Side Panel API stabile).

## Difese per l'agente

- Blocco navigazione verso `javascript:`/`data:`/`file:`/`chrome:*`/`about:*` e Web Store;
  allowlist domini opzionale.
- Campi password: mai il valore nello snapshot, digitazione bloccata di default.
- Budget tool-call per run + timeout 10s per risposta content script + timeout globale run
  - STOP (pulsante e `Ctrl/Cmd+Shift+X`) che abortisce LLM e azioni.
- La chiave API non è mai loggata né inclusa in export/log; errori provider mappati in
  messaggi che non espongono la chiave.

## Minacce note (limiti onesti)

- **Prompt injection dalle pagine**: lo snapshot contiene testo di siti terzi che può
  contenere istruzioni malevole ("ignora le regole e..."). Il system prompt ordina di usare
  solo ref/URL osservati e mai inventare azioni; resta il rischio intrinseco degli agenti
  browser. Non usare lmuse per task con dati critici su siti non fidati.
- **Il modello vede ciò che vede**: snapshot e screenshot vanno al provider. Usa provider
  locali (Ollama/LM Studio) per dati sensibili.
- **Service worker MV3**: su task molto lunghi Chrome può sospendere il worker; il
  risultato resta nell'inbox, ma un run può interrompersi (vedi roadmap: offscreen document).

## Segnalare una vulnerabilità

Apri una issue privata o contatta il maintainer con: versione (`0.2.0`), passi per
riprodurre, impatto stimato. Non pubblicare exploit prima di un fix. Risponderemo con
tempistiche di fix entro 7 giorni.
