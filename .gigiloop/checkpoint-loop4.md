# GigiLoop loop 4 — Checkpoint (FINALE)

## Goal

lmuse 0.4.0 → 0.5.0 con 100 migliorie (voci 301–400): streaming live, task
programmati, find/table/query, shadow DOM, run history, import/export profilo.

## Baseline (Phase 0)

- branch: main, HEAD = origin/main = `3a452a7`, tree pulito
- verify: `pnpm check` verde (typecheck + 176/176 test + lint + build)
- budget: default 25 iterazioni

## Rubric (post-reconcile)

| Criterio | Peso | Evidenza | Score |
|---|---:|---|---|
| Sicurezza | 30% | validate/import/query testati, audit grep, CI scan+no-remote | 9/10 |
| Privacy | 25% | export/import/stream/schedule testati e documentati | 9/10 |
| Robustezza | 25% | 199/199 test, e2e 7/7, stream, schedule, circuit | 9/10 |
| Qualità | 10% | axe, chromium-age, links, CONTRIBUTING, STORE, tag+Release | 9/10 |
| Documentazione | 10% | GUIDA(mermaid)/README/PRIVACY/SECURITY/CHANGELOG coerenti | 9/10 |

**Post-reconcile: 9.0/10.** Residui: prompt injection intrinseca, `<all_urls>`,
stream/tool-callback su `stream()` da confermare con chiave reale (typecheck ok,
ma mai eseguito end-to-end), crop element-shot idem, pin Chromium che invecchia
(check automatico in CI).

## Stato

- 100/100 voci PIANO-400 applicate e verificate
- `pnpm check` verde (typecheck + 199 test + lint + build), coverage sopra soglie
- e2e verde (Chromium pinnato): SW, manifest 0.5.0, panel, ⚙, zero errori, axe
- `pnpm release` → `release/lmuse-0.5.0.zip` + sha256; tag v0.5.0 + Release

## Iterazioni

- A: shared (schedules, profile, stop-text, run-history, i18n totale) + test
- B: streaming agent + token-guard + stop-check (con fix meccanismo STOP_TEXT)
- C: find/table/query + read-main + shadow DOM + jsdom
- D: runtime schedule + panel (stream, sound, compact, template, history, counter)
- E: Q (axe→fix contrasto reale, chromium-age, no-remote-code, CONTRIBUTING, STORE)
- F: docs + 0.5.0 + tag/Release
- red-team: STOP_TEXT non usciva dai tool-error (fix via system prompt),
  branded Chrome blocca --load-extension (documentato), tag/commits allineati
