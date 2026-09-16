# lmuse

Estensione Chrome (MV3): un agente AI che usa il browser per svolgere task,
con la tua chiave LLM — compatibile con OpenAI, Anthropic, Google, xAI, DeepSeek,
Groq, Cerebras, Mistral, Azure, OpenRouter, Ollama, LM Studio e qualsiasi
endpoint OpenAI-compatibile.

- Nessun server nostro, nessuna telemetria: la chiave resta sul tuo PC.
- Conferma umana per le azioni sensibili (navigazione, invio form, cambio tab).
- 21 tool browser: snapshot, click, digitazione, select, wait, press, find, table,
  query, scroll, screenshot (anche ritagliato), lettura testo/link, tab multipli.
- Template task, preset Veloce/Preciso/Locale, task programmati, health-check integrato.
- Streaming live, stop-text, token-guard, import/export profilo.
- Sicurezza & privacy verificate: leggi **[PRIVACY.md](PRIVACY.md)** e **[GUIDA.md](GUIDA.md)**.
- Vedi **[CHANGELOG.md](CHANGELOG.md)** per le novità della 0.5.0.

Permessi (perché servono): `storage` (impostazioni/chiave locali), `scripting`
(iniezione on-demand solo quando il task agisce), `tabs`+`activeTab` (leggere e
comandare il tab), `sidePanel` (il pannello), host su tutti i siti (lavorare dove
gli chiedi — restringibile con allowlist). Niente `debugger`, niente cookie, niente rete
oltre al provider LLM che scegli.

```bash
pnpm install && pnpm check   # typecheck + test + lint + build
pnpm build                   # poi carica dist/ in chrome://extensions
```

Leggi **[GUIDA.md](GUIDA.md)** per architettura, setup, scorciatoie e roadmap.
Stato CI: `pnpm check` verde (typecheck + 199 test vitest + lint + build), e2e smoke
con a11y, coverage `src/shared` > 90%, audit + secret-scan + size + links attivi.
Contribuire: vedi **[CONTRIBUTING.md](CONTRIBUTING.md)**.
