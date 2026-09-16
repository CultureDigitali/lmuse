# Piano 100 migliorie v3 — lmuse 0.4.0 (GigiLoop loop 3)

Obiettivo: nuovi tool (select/wait/press/read/links), health-check connessione,
trusted domains, template/preset, e2e smoke, log UX. [x] = applicata e verificata.

## Sicurezza III (S201–S225)

- [x] S201 [code] `trustedDomains` in settings + banner approval "ricorda" (skip futuro)
- [x] S202 [code] `shouldApprove` consulta trusted (navigate verso trusted = no domanda)
- [x] S203 [code] Descrizioni APPROVAL mascherate (token URL mai al panel in chiaro)
- [x] S204 [code] Broadcast ERROR mascherati (niente token/secret nei messaggi)
- [x] S205 [code] `sanitizeTask`: strip control/zero-width chars (pura + test)
- [x] S206 [code] SELECT: rifiuta option inesistente e select disabilitata
- [x] S207 [code] WAIT: timeout max 30s, solo text/selector non vuoti
- [x] S208 [code] PRESS: allowlist tasti (Escape/Tab/frecce, niente Enter/Invio)
- [x] S209 [code] TEST_CONNECTION: timeout 20s, richiede chiave plausibile
- [x] S210 [audit] Nuovi tool rispettano `hidePasswords`/`maskPii` (grep flag)
- [x] S211 [audit] `scripting.executeScript` solo `files:` (grep, mai `func:`)
- [x] S212 [audit] `.gitignore` copre `coverage/` (artefatti fuori git)
- [x] S213 [code] READ_TEXT: applica maskPii secondo flag
- [x] S214 [code] LINKS: cap 200 link + token redatti
- [x] S215 [code] SELECT su campo password/disabilitato → errore esplicito
- [x] S216 [code] Setting `approvalTimeoutSec` (30–300, default 120)
- [x] S217 [code] Trusted matching: dominio esatto o sottodominio (come allowlist)
- [x] S218 [code] SECURITY.md: rationale aggiornata (nuovi usi `tabs`/`scripting`)
- [x] S219 [audit] Nuove chiavi storage documentate in PRIVACY.md
- [x] S220 [code] SECURITY.md: note test-connection ed element-screenshot
- [x] S221 [code] APPROVE/DENY con id scaduto/ignoto ignorati senza crash (test schema)
- [x] S222 [audit] Motivo navigate mostra sempre il dominio in chiaro (grep reason)
- [x] S223 [audit] Solo Port `lmuse` accettata (grep name check)
- [x] S224 [audit] Badge solo cifre/`RUN` (niente dati, grep setBadge)
- [x] S225 [code] e2e: assert nessun errore SW all'installazione

## Privacy III (P226–P245)

- [x] P226 [code] `trustedDomains` persistiti in settings (max 50, normalizzati)
- [x] P227 [code] `savedPrompts` in settings (max 20, truncate 300)
- [x] P228 [code] `theme` in settings (auto/dark/light, default auto)
- [x] P229 [code] Nota PRIVACY: host tab attivo mostrato nel panel (solo locale)
- [x] P230 [code] Test-connection invia solo probe "OK" (documentato)
- [x] P231 [code] READ_TEXT redatto secondo flag (test jsdom)
- [x] P232 [code] LINKS con token redatti (test)
- [x] P233 [code] Export log solo download locale (niente upload)
- [x] P234 [code] Filtro log solo client-side (nessun dato esce)
- [x] P235 [code] Element-screenshot ritagliato in locale prima dell'invio (meno dati)
- [x] P236 [audit] STEP masking copre i nuovi tool (grep mask in index.ts)
- [x] P237 [code] `locale` it/en persistito (default auto da browser)
- [x] P238 [audit] Inbox non salva mai il task (re-audit codice)
- [x] P239 [code] Clear-all cancella anche trusted/templates/theme
- [x] P240 [code] PRIVACY.md: sezione loop-3 (trusted, templates, probe, crop)
- [x] P241 [audit] Theme: nessuna telemetria, solo classe CSS (grep)
- [x] P242 [code] Templates: cap + truncate testati
- [x] P243 [audit] Collapse log: nessun dato inviato (solo rendering)
- [x] P244 [audit] `captureVisibleTab` solo in 2 call-site espliciti (grep)
- [x] P245 [code] Badge solo `RUN`/`n/max` (audit S224 condiviso, testo cifre)

## Robustezza III (R246–R270)

- [x] R246 [code] Tool `browser_select` + content SELECT + conferma label
- [x] R247 [code] Tool `browser_wait` (text/selector, MutationObserver, timeout)
- [x] R248 [code] Tool `browser_press` (allowlist pura testata + dispatch)
- [x] R249 [code] Tool `browser_reload` (reload + attesa + snapshot)
- [x] R250 [code] Tool `browser_forward` (goForward + snapshot)
- [x] R251 [code] Tool `browser_read_text` (innerText troncato + mask)
- [x] R252 [code] Tool `browser_links` (href+testo, cap, mask)
- [x] R253 [code] Tool `browser_tab_duplicate` (duplicate + focus + snapshot)
- [x] R254 [code] `FailureCircuit` pura: 5 errori consecutivi → stop run (test)
- [x] R255 [code] Circuit wired in `guarded` (reset su successo)
- [x] R256 [code] SW startup: pulizia badge stale
- [x] R257 [code] TEST_CONNECTION handler SW + bottone panel + errori mappati
- [x] R258 [code] Header panel: host tab attivo (refresh su focus finestra)
- [x] R259 [code] Badge `n/max` passi durante il run
- [x] R260 [code] Setting `snapshotMaxChars` (4k–20k) wired a truncate
- [x] R261 [code] SELECT verifica selectedIndex/label dopo dispatch (jsdom)
- [x] R262 [code] PRESS ritorna descrittore elemento focalizzato
- [x] R263 [code] RELOAD riusa attesa+snapshot (come navigate)
- [x] R264 [code] DUPLICATE snapshot del nuovo tab
- [x] R265 [code] Template applicato riempie il composer
- [x] R266 [code] Template add/delete persistiti (max 20)
- [x] R267 [code] Toggle lingua it/en persistito
- [x] R268 [code] Preset veloci (3) applicano model+maxSteps+screenshot
- [x] R269 [code] Timestamp (title attr) sulle voci di log
- [x] R270 [code] SELECT change-event verificato nei test (selectedIndex)

## Qualità III (Q271–Q280)

- [x] Q271 [code] e2e smoke puppeteer (`test:e2e`: install, SW, panel, zero errori)
- [x] Q272 [code] CI job e2e (setup-chrome headless)
- [x] Q273 [code] CI: `test:coverage` con soglie (gap loop 2)
- [x] Q274 [code] `scripts/check-links.mjs` + CI (link docs → file esistenti)
- [x] Q275 [code] Issue/PR template GitHub
- [x] Q276 [code] `pnpm outdated` valutato, minor sicure aggiornate
- [x] Q277 [code] Versione 0.4.0 coerente package/manifest/CHANGELOG
- [x] Q278 [code] AGENTS.md aggiornata (nuovi script/comandi)
- [x] Q279 [code] Tag `v0.4.0` + GitHub Release con zip
- [x] Q280 [code] `release` stampa checksum sha256 dello zip

## Documentazione III (D281–D290)

- [x] D281 [code] GUIDA: nuovi tool (select/wait/press/read/links/duplicate/reload/forward)
- [x] D282 [code] GUIDA: trusted domains, template, preset, theme, lingua
- [x] D283 [code] GUIDA: health-check connessione + costi aggiornati
- [x] D284 [code] GUIDA: troubleshooting (circuit, e2e, SW startup, orphan)
- [x] D285 [code] README aggiornato (feature 0.4.0)
- [x] D286 [code] CHANGELOG 0.4.0 completo
- [x] D287 [code] SECURITY.md: minacce nuovi tool valutate
- [x] D288 [code] GUIDA: tabella impostazioni aggiornata (nuove chiavi)
- [x] D289 [code] GUIDA: FAQ (template, trusted, test connessione, e2e)
- [x] D290 [code] GUIDA: diagramma flusso aggiornato (approval+nuovi tool)

## UX III (U291–U300)

- [x] U291 [code] Filtro log: tutti/tool/errori
- [x] U292 [code] Export log: download file locale
- [x] U293 [code] Voci lunghe collassabili (details/summary)
- [x] U294 [code] Toggle tema auto/dark/light
- [x] U295 [code] Toggle lingua it/en
- [x] U296 [code] Template UI: salva/usa/elimina
- [x] U297 [code] Bottoni preset (Veloce/Preciso/Locale)
- [x] U298 [code] Chip host tab attivo nell'header
- [x] U299 [code] CSS: prefers-reduced-motion + focus-visible
- [x] U300 [code] Timestamp sulle voci di log

## Report finale

(da compilare a fine loop)

## Report finale

- 100/100 voci applicate e verificate (2026-09-16). Score post-reconcile: 9.0/10.
- `pnpm check` verde: typecheck + 176/176 test + lint + build. Coverage src/shared:
  92% stmts / 89% branch / 97% funcs.
- e2e smoke verde (Chromium pinnato 1698520): SW, id, manifest 0.4.0, panel, zero errori.
- `pnpm release` → `release/lmuse-0.4.0.zip` + sha256. Tag v0.4.0 + GitHub Release.
- Nota onesta: il tag era stato creato prima del commit (puntava a e5d7269);
  riallineato al commit 0.4.0 con OK utente, Release ricreata.
- Fix reali emersi: innerText assente in jsdom (fallback textContent), toModelOutput
  va tenuta inline (inferenza AI SDK), snapshot primo-uso senza inject, branded Chrome
  blocca --load-extension (serve Chromium), YAML CI rotto da `run:` inline.
- Rischi residui in SECURITY.md.
