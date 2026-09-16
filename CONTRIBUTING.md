# Contribuire a lmuse

Grazie per l'interesse! lmuse è un'estensione Chrome MV3 (TypeScript + React + AI SDK).

## Setup

```bash
pnpm install
pnpm check   # typecheck + test + lint + build: deve essere verde prima di ogni PR
```

Serve Node ≥ 22 e pnpm 9. Dettagli architettura: [GUIDA.md](GUIDA.md).

## PR

1. Fork + branch dal `main` (`feat/...`, `fix/...`).
2. Usa il template PR (checklist verifica + privacy).
3. Una PR = un tema; test per ogni funzione pura nuova in `src/shared/*.test.ts`
   (DOM in `src/content/*.test.ts` con jsdom).
4. `pnpm check`, `pnpm lint`, `pnpm format:check` verdi; CI deve passare
   (typecheck, coverage, lint, build, verify-dist, size, links, audit, secret-scan, e2e).

## Regole d'oro

- Mai `eval`/`innerHTML`/`new Function`; niente `console.log` in `src/`.
- La chiave API non vive in `Settings` e non finisce mai nei log (vedi PRIVACY.md).
- Nessun nuovo permesso senza rationale in SECURITY.md.
- Messaggi utente in italiano; stringhe UI in `src/shared/i18n.ts` (it + en).
- Ogni feature aggiorna GUIDA.md (+ PRIVACY/SECURITY/CHANGELOG se tocca dati o permessi).

## Segnalazioni

Usa i template issue (bug/feature). Per vulnerabilità vedi [SECURITY.md](SECURITY.md):
non pubblicare exploit prima di un fix.
