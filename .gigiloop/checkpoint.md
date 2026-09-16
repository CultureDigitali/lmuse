# GigiLoop — Checkpoint (FINALE)

## Goal

Applicare 100 migliorie al progetto lmuse (estensione Chrome MV3 agente AI), con focus
sul tema sicurezza e privacy, verificando ogni batch con typecheck/test/build.

## Repository state (baseline)

- git: nessun commit (albero tutto untracked)
- hash albero src+public+sidepanel baseline: `c07c2449656990e6a74d139bdb9ccdc4fe9dacd668ea4e554239a9915baffbcf`
- verify commands: `pnpm check` (typecheck+test+build), `pnpm lint`, `pnpm format`
- baseline: typecheck OK, build OK (warning chunk-size), nessun test presente
- nota: node via nvm v22.23.2 (PATH export richiesto per pnpm/tsc)

## Rubric

| Criterio               | Peso | Evidenza                                                         | Score |
| ---------------------- | ---: | ---------------------------------------------------------------- | ----: |
| Sicurezza              |  30% | typecheck+test urlGuard/budget+audit grep chiave/CSP/sender      |  9/10 |
| Privacy                |  25% | 47 test (pii incl. fix telefoni) + PRIVACY.md + audit telemetria |  9/10 |
| Correttezza/robustezza |  25% | check+lint verdi, reconnect, timeout+dispose, ref-rescue         |  8/10 |
| Qualità progetto       |  10% | vitest+CI+eslint+prettier+release zip verificato                 |  9/10 |
| Documentazione         |  10% | GUIDA/PRIVACY/SECURITY/CHANGELOG/LICENSE coerenti                |  9/10 |

**Post-reconcile: 8.8/10.** Residui onesti: prompt-injection intrinseca (documentata),
`host_permissions: <all_urls>` (documentata, alternativa in roadmap), nessun test e2e
con chiave reale (richiede Chrome + chiave, fuori portata qui).

## Stato

- iterazione: 5/5 — 100/100 voci PIANO applicate e verificate
- prossimo passo: nessuno (loop chiuso); eventuale commit git a discrezione utente

## Iterazioni

- iter 1: batch S+P+R (shared, manifest, content, background, sidepanel, stili) → typecheck+build
- iter 2: batch Q (vitest 47 test, CI, eslint+react-hooks, prettier, release) → test+lint+build
  - fix reale trovato dai test: regex telefoni non copriva `+39 ...` né cifre continue → ampliata
  - downgrade typescript 7.0→5.9 (typescript-eslint non supporta TS7)
- iter 3: batch D+U (PRIVACY/SECURITY/CHANGELOG/LICENSE/README/GUIDA) → build
- iter 4: red-team → fix leak timer withTimeout (dispose in finally)
- iter 5: final gate `pnpm check` + `pnpm lint` verdi, `pnpm release` zip verificato
