# Piano 100 migliorie v4 — lmuse 0.5.0 (GigiLoop loop 4)

Obiettivo: streaming live, task programmati, find/table/query, shadow DOM,
run history, import/export profilo. [x] = applicata e verificata.

## Sicurezza IV (S301–S325)

- [x] S301 [code] Permesso `alarms`: rationale in SECURITY.md (solo scheduling locale)
- [x] S302 [code] `validateSchedule` pura: max 5, intervallo 60–10080min, task 1–4000 (test)
- [x] S303 [audit] Schedule senza segreti: solo task+intervallo (grep tipo)
- [x] S304 [code] Import profilo: chiavi ignote scartate, anti `__proto__` (test)
- [x] S305 [code] CI no-remote-code: niente `src=`/`@import` http in `src/` (grep step)
- [x] S306 [audit] `scripting` solo `files:` (re-audit grep)
- [x] S307 [code] FIND evidenzia solo con `<mark>` via DOM API (mai HTML, audit)
- [x] S308 [code] TABLE converter con escape + cap righe/celle (test)
- [x] S309 [code] Stop-text valutato solo in locale (nota + audit)
- [x] S310 [code] Token-guard: abort oltre soglia per run
- [x] S311 [code] Setting `maxTokensPerRun` (1k–200k, default 60k)
- [x] S312 [code] TEST_CONNECTION sotto cooldown 5s (riuso `canStartRun`)
- [x] S313 [audit] Run schedulati passano da `startRun` (stessi controlli chiave/cool)
- [x] S314 [audit] Sender/Port check invariati (grep)
- [x] S315 [code] QUERY: selettore non vuoto, errore chiaro se invalido (test)
- [x] S316 [code] QUERY cap 100 ref (content)
- [x] S317 [code] FIND cap 100 match + pulizia marks precedenti
- [x] S318 [code] `approvalTimeoutFor(audience)`: 20s unattended, setting altrimenti (test)
- [x] S319 [code] Unattended fast-deny: niente auto-approve mai (log esplicito)
- [x] S320 [audit] `resolve(true)` solo su APPROVE (grep, mai auto-approve)
- [x] S321 [audit] Stream renderizzato come testo (React escape, niente HTML)
- [x] S322 [code] Export filename solo timestamp (niente input utente)
- [x] S323 [code] Import: try/catch + shape check + cap 100KB (test validator)
- [x] S324 [audit] Clipboard solo su gesto utente (grep handlers)
- [x] S325 [code] SECURITY.md: schedules, streaming, import/export, query

## Privacy IV (P326–P345)

- [x] P326 [audit] STREAM mai persistito (grep save/set)
- [x] P327 [code] Schedule in settings + clear-all azzera anche `alarms`
- [x] P328 [code] Export include schedules/template (mai chiave, test shape)
- [x] P329 [code] Import scarta campo chiave se presente (test)
- [x] P330 [audit] Stop-text non persistito (solo memoria run)
- [x] P331 [code] Nota costi: default maxTokens 60k documentato
- [x] P332 [audit] Marks `<mark>` solo visuali, niente dati (nota)
- [x] P333 [code] Setting `soundOnDone` (default off)
- [x] P334 [code] Setting `compactLog` (default off)
- [x] P335 [code] `lastRuns` max 10 troncate in settings
- [x] P336 [audit] Run-history senza task completi? NO — task troncato 200ch ok (nota)
- [x] P337 [code] PRIVACY.md: sezione loop-4
- [x] P338 [audit] Tabella chiavi storage aggiornata (nessuna nuova chiave chrome)
- [x] P339 [audit] STREAM non salvato in inbox (solo testo finale, grep)
- [x] P340 [code] Export filename senza dati utente (timestamp)
- [x] P341 [audit] Task schedulati mai in console (grep)
- [x] P342 [code] Import cap 100KB + solo JSON (test)
- [x] P343 [code] Clear-all: `chrome.alarms.clearAll()` incluso
- [x] P344 [audit] Sound default off (grep default)
- [x] P345 [audit] Compact default off (grep default)

## Robustezza IV (R346–R370)

- [x] R346 [code] `agent.stream` wiring + broadcast STREAM
- [x] R347 [code] Panel: bolla streaming live per id
- [x] R348 [code] Stream chiuso su ERROR/DONE (niente bolle orfane)
- [x] R349 [code] Stop-text: `containsStop` pura + check per snapshot (test)
- [x] R350 [code] Token-guard cumulativo via usage step → abort
- [x] R351 [code] Schedules: `chrome.alarms` wiring + onAlarm → startRun se idle
- [x] R352 [code] Schedules UI add/delete/toggle
- [x] R353 [audit] Alarms persistenti al restart (nota + clear solo su richiesta)
- [x] R354 [code] `lastRuns` helpers puri + test
- [x] R355 [code] Export profilo download (settings − chiave + versione)
- [x] R356 [code] Import profilo upload + validate + apply
- [x] R357 [code] Tool `browser_find` (highlight + count + clear)
- [x] R358 [code] Tool `browser_table` (table → markdown)
- [x] R359 [code] Tool `browser_query` (selector → ref list)
- [x] R360 [code] READ_TEXT mode full/main (article/main fallback)
- [x] R361 [code] Shadow DOM piercing nello snapshot (jsdom test)
- [x] R362 [code] Perf test snapshot 5k nodi < 2s
- [x] R363 [code] i18n parità totale (export STRINGS + test)
- [x] R364 [code] Composer counter caratteri + hint max
- [x] R365 [code] Compact mode: nasconde chatter tool
- [x] R366 [code] Sound on done (WebAudio, off default)
- [x] R367 [code] Badge ✓ a DONE con panel chiuso
- [x] R368 [code] Badge pulito all'apertura panel
- [x] R369 [code] Import validator tests
- [x] R370 [code] e2e: assert bottone ⚙ presente (panel interattivo)

## Qualità IV (Q371–Q380)

- [x] Q371 [code] axe-core a11y in e2e (zero serious/critical)
- [x] Q372 [code] check-chromium-age script + CI (fail oltre 120gg)
- [x] Q373 [code] CI step no-remote-code
- [x] Q374 [code] CONTRIBUTING.md
- [x] Q375 [code] STORE.md (listing Web Store draft)
- [x] Q376 [code] Mermaid architettura in GUIDA
- [x] Q377 [code] `pnpm outdated` valutato, minor sicure aggiornate
- [x] Q378 [code] Versione 0.5.0 coerente
- [ ] Q379 [code] Tag v0.5.0 + GitHub Release
- [x] Q380 [code] AGENTS.md aggiornata

## Documentazione IV (D381–D390)

- [x] D381 [code] GUIDA: streaming live
- [x] D382 [code] GUIDA: task programmati
- [x] D383 [code] GUIDA: import/export + run history
- [x] D384 [code] GUIDA: nuovi tool (find/table/query)
- [x] D385 [code] GUIDA: tabella impostazioni aggiornata
- [x] D386 [code] README aggiornato
- [x] D387 [code] CHANGELOG 0.5.0
- [x] D388 [code] SECURITY.md: minacce schedules/streaming/import
- [x] D389 [code] GUIDA: troubleshooting (stream, alarm, import)
- [x] D390 [code] GUIDA: FAQ (programmati, token-guard, stop-text, import)

## UX IV (U391–U400)

- [x] U391 [code] Bolla streaming live
- [x] U392 [code] Run history UI + clear
- [x] U393 [code] Schedules UI (add/list/delete/toggle)
- [x] U394 [code] Import/export UI (download + upload)
- [x] U395 [code] Toggle compact UI
- [x] U396 [code] Toggle sound UI
- [x] U397 [code] Counter composer UI
- [x] U398 [code] Next-run label (tra Xh, helper+test+UI)
- [x] U399 [code] aria-live su streaming e approval
- [x] U400 [code] Focus composer dopo DONE

## Report finale

(da compilare a fine loop)

## Report finale

- 100/100 voci applicate e verificate (2026-09-16). Score post-reconcile: 9.0/10.
- `pnpm check` verde: typecheck + 199/199 test + lint + build. Coverage sopra soglie.
- e2e verde 7/7 (Chromium 1698520): SW, manifest 0.5.0, panel, impostazioni,
  zero errori, axe zero serious/critical (dopo fix contrasto #a83232).
- `pnpm release` → zip + sha256. Tag v0.5.0 + GitHub Release (dopo commit, stavolta).
- Fix reali emessi: STOP_TEXT via tool-error→system prompt (non throw-to-SW),
  contrasto light-theme, YAML CI, `%20` già noto.
- Residui onesti in checkpoint (stream callbacks e crop da provare con chiave reale).
