# GigiLoop loop 3 — Checkpoint (FINALE)

## Goal

lmuse 0.3.0 → 0.4.0 con 100 migliorie (voci 201–300): nuovi tool browser,
health-check, trusted domains, template/preset, e2e smoke, log UX.

## Baseline (Phase 0)

- branch: main, HEAD = origin/main = `e5d7269`, tree pulito
- verify: `pnpm check` verde (typecheck + 130/130 test + lint + build)
- budget: default 25 iterazioni

## Rubric (post-reconcile)

| Criterio | Peso | Evidenza | Score |
|---|---:|---|---|
| Sicurezza | 30% | allowlist/trusted/select/wait/press testati, audit grep, CI scan | 9/10 |
| Privacy | 25% | read/links/hostOnly/probe testati e documentati, nessun nuovo permesso | 9/10 |
| Robustezza | 25% | 176/176 test, e2e verde, circuit, badge, orphan | 9/10 |
| Qualità | 10% | e2e+coverage+links in CI, templates GH, tag+Release | 9/10 |
| Documentazione | 10% | GUIDA/README/PRIVACY/SECURITY/CHANGELOG/AGENTS coerenti | 9/10 |

**Post-reconcile: 9.0/10.** Residui: prompt injection intrinseca, `<all_urls>`,
crop element-screenshot non provato runtime (serve chiave), Chromium e2e pinnato.

## Stato

- 100/100 voci PIANO-300 applicate e verificate
- `pnpm check` verde (typecheck + 176 test + lint + build), coverage shared
  92% stmts / 89% branch / 97% funcs (soglie 85/85/80)
- e2e smoke verde su Chromium 1698520 (5/5 controlli)
- `pnpm release` → `release/lmuse-0.4.0.zip` + sha256
- tag v0.4.0 + GitHub Release pubblicata (tag riallineato al commit 0.4.0 dopo fix)

## Iterazioni

- A: shared (trusted, template, theme, locale, preset, circuit, task) + test
- B: 9 nuovi tool + content (select/wait/press/text/links/rect) + jsdom
- C: runtime (circuit, badge passi, startup, test-connection, masking)
- D: panel (filter, export, collapse, theme, lingua, template, preset, host)
- E: Q (e2e Chromium reale, coverage CI, check-links, templates GH, outdated)
- F: docs + 0.4.0 + tag/Release (con fix riallineamento tag)
- red-team: jsdom innerText fallback, toModelOutput inline, snapshot-inject,
  tag puntava al commit sbagliato (fix con OK utente)
