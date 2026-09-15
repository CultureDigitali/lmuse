# Changelog — lmuse

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
