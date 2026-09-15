# lmuse

Estensione Chrome (MV3): un agente AI che usa il browser per svolgere task,
con la tua chiave LLM — compatibile con OpenAI, Anthropic, Google, xAI, DeepSeek,
Groq, Cerebras, Mistral, Azure, OpenRouter, Ollama, LM Studio e qualsiasi
endpoint OpenAI-compatibile.

- Nessun server nostro, nessuna telemetria: la chiave resta sul tuo PC.
- Sicurezza & privacy verificate: leggi **[PRIVACY.md](PRIVACY.md)** e **[GUIDA.md](GUIDA.md)**.
- Vedi **[CHANGELOG.md](CHANGELOG.md)** per le novità della 0.2.0.

```bash
pnpm install && pnpm check   # typecheck + test + build
pnpm build                   # poi carica dist/ in chrome://extensions
```

Leggi **[GUIDA.md](GUIDA.md)** per architettura, setup, scorciatoie e roadmap.
Stato CI: `pnpm check` verde (typecheck + 47 test vitest + build), ESLint + Prettier.
