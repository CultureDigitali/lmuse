# Changelog — lmuse

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
