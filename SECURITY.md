# Security — lmuse

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

| Permesso          | Uso                                              | Alternativa valutata                           |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| `storage`         | settings/chiave/cronologia locali                | nessuna (serve persistenza)                    |
| `scripting`       | inject on-demand di `content.js` (solo `files:`) | content script statico (peggio: sempre attivo) |
| `tabs`            | leggere URL/titolo, elencare e fokusare tab      | `activeTab` solo (insufficiente per multi-tab) |
| `activeTab`       | agire sul tab attivo senza prompt                | —                                              |
| `sidePanel`       | pannello laterale                                | popup (peggiore per task lunghi)               |
| host `<all_urls>` | operare dove l'utente chiede                     | `optional_host_permissions` per-sito (roadmap) |

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

## Segnalare una vulnerabilità

Apri una issue privata o contatta il maintainer con: versione (`0.3.0`), passi per
riprodurre, impatto stimato. Non pubblicare exploit prima di un fix. Risponderemo con
tempistiche di fix entro 7 giorni.
