# GigiLoop loop 2 — Checkpoint (FINALE)

## Goal

Portare lmuse da 0.2.0 a 0.3.0 con 100 nuove migliorie verificate (voci 101–200):
human-approval per azioni sensibili, content script on-demand, resilienza run,
trasparenza costi, suite test estesa.

## Baseline (Phase 0)

- branch: main, HEAD: `9f3448b`, tree pulito
- verify: `pnpm check` verde (typecheck + 47/47 test + build), `pnpm lint` verde
- budget: default 25 iterazioni (usate ~7 batch effectivi)

## Rubric (post-reconcile)

| Criterio       | Peso | Evidenza                                                                          | Score |
| -------------- | ---: | --------------------------------------------------------------------------------- | ----: |
| Sicurezza      |  30% | approval runtime testata, on-demand, sender check, CI audit+secret-scan puliti    |  9/10 |
| Privacy        |  25% | header/hostOnly/tracking-strip testati, PRIVACY aggiornata, nessun nuovo permesso |  9/10 |
| Robustezza     |  25% | auto-snapshot, run-state orfano, retry, usage, 130/130 test                       |  9/10 |
| Qualità        |  10% | coverage shared 93%, size-check, verify-dist, CI estesa, Dependabot               |  9/10 |
| Documentazione |  10% | GUIDA/PRIVACY/SECURITY/CHANGELOG/README/AGENTS coerenti                           |  9/10 |

**Post-reconcile: 9.0/10.** Residui onesti: prompt injection intrinseca, `<all_urls>`
(documentati), nessun e2e con chiave reale (richiede Chrome + chiave).

## Stato

- 100/100 voci PIANO-200 applicate e verificate
- `pnpm check` verde (typecheck + 130 test + lint + build), coverage > soglie
- `pnpm release` → `release/lmuse-0.3.0.zip` (verify-dist + check-size dentro)
- prossimo passo: commit loop-2 (da chiedere all'utente)

## Iterazioni

- A: shared pure (approval, header, tracking, usage, runstate) + 44 test nuovi
- B: runtime (on-demand inject, sender check, auto-snapshot, approval SW, usage)
- C: panel (banner approval/countdown, retry, orfano, onboarding, toolbar, stats)
- D: Q infra (jsdom, coverage v8, check-size, verify-dist, audit+scan CI, AGENTS)
- E: docs + 0.3.0 + patch minors (xai major 5.0 escluso)
- red-team: fix snapshot-primo-uso senza inject + estensione test parità i18n
