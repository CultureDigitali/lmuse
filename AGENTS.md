# AGENTS.md — istruzioni per chi modifica lmuse

## Comandi (Node ≥ 22, pnpm 9)

```bash
pnpm install
pnpm check          # typecheck + test + lint + build (gate prima di ogni commit)
pnpm test           # vitest (176+ test)
pnpm test:coverage  # coverage v8, soglie 85/85/80 su src/shared
pnpm test:e2e        # smoke su Chromium reale (auto-scaricato in ~/.cache)
pnpm check-links     # link relativi nei .md
pnpm release        # check + verify-dist + zip in release/
```

Node via nvm: `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"` se pnpm non è nel PATH.

## Convenzioni

- TypeScript strict, ESLint 9 flat (+ react-hooks), Prettier (single quote, width 110).
- Mai `eval`/`innerHTML`/`new Function`; niente `console.log` in `src/` (solo warn/error se serve).
- La chiave API non vive mai in `Settings`: parametro dedicato + storage separato, mai nei log.
- Test: funzioni pure in `src/shared/*.test.ts`; DOM in `src/content/*.test.ts` (jsdom);
  per `chrome.*` usare `vi.stubGlobal('chrome', …)` come in `settings-io.test.ts`.
- Messaggi panel↔worker: estendere gli schemi zod in `src/shared/settings.ts` + test.
- Errori utente sempre in italiano tramite `mapProviderError`/`mapTabError`.
- Docs: ogni feature tocca GUIDA.md + (se privacy/sicurezza) PRIVACY.md/SECURITY.md + CHANGELOG.md.
