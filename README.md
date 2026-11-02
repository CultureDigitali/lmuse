# lmuse

> **Beta 0.9.0 in sviluppo su branch dedicato.** Ultima release GitHub stabile: v0.8.1. Non installare la beta sul profilo con account di produzione prima del collaudo.

Estensione Chrome (MV3): un agente AI che usa il browser per svolgere task,
con la tua chiave LLM — **25 provider** supportati: OpenAI, Anthropic, Google,
xAI, Azure, DeepSeek, Groq, Cerebras, Mistral, Cohere, Together AI, Fireworks,
DeepInfra, Perplexity, Hugging Face, NVIDIA NIM, SambaNova, Baseten, GitHub
Models, OpenRouter, OpenCode Zen, Vercel AI Gateway, Ollama, LM Studio e
qualsiasi endpoint OpenAI-compatibile.

- Nessun server nostro, nessuna telemetria: la chiave resta sul tuo PC
  (keystore **per-provider**, migrazione automatica dalla 0.5.x).
- **Integrazione opencode**: rileva le credenziali già configurate in opencode
  (auth.json) e le importa con un click, via native bridge (`pnpm setup:opencode`).
- Conferma esplicita per click e digitazione; in modalità rigorosa, consenso anche prima della lettura di ogni sito.
- **Blocco automatico chiave** opzionale: si cancella dopo N minuti di inattività.
- **27 tool browser**: snapshot, click, digitazione, select, wait, press, find, table,
  query, hover, clipboard, iframe, download, scroll, screenshot (anche ritagliato),
  lettura testo/link, tab multipli.
- Template task, preset Veloce/Preciso/Locale, task programmati, coda task,
  model discovery live, health-check integrato.
- Streaming live, stop-text, token-guard, import/export profilo, export log markdown.
- Service worker MV3 con import statici (gli import dinamici causavano un blocco dell'esecuzione).
- **Privacy Gateway v0.9.0**: sostituzione reversibile in RAM per email, telefoni, IBAN, carte e token riconosciuti; ripristino solo sul sito originale. Screenshot e upload automatici bloccati nelle modalità protette. Vedi **[PRIVACY-GATEWAY.md](PRIVACY-GATEWAY.md)**, **[PRIVACY.md](PRIVACY.md)** e **[SECURITY.md](SECURITY.md)**.
- **Solo chiavi API, non abbonamenti consumer**: Antigravity/Google AI Pro, ChatGPT Plus e
  simili non sono utilizzabili da terze parti (ToS); per Gemini serve una chiave di
  Google AI Studio. Vedi la FAQ in GUIDA.md.
- **Solo modelli gratuiti** (default): OpenRouter `openrouter/free` / `:free`, NVIDIA NIM free tier.
- Vedi **[CHANGELOG.md](CHANGELOG.md)** per le novità della 0.9.x.

Permessi (perché servono): `storage` (impostazioni/chiave locali), `scripting`
(iniezione on-demand solo quando il task agisce), `tabs`+`activeTab` (leggere e
comandare il tab), `sidePanel` (il pannello), host su tutti i siti (lavorare dove
gli chiedi — restringibile con allowlist). Niente `debugger`, niente cookie, niente rete
oltre al provider LLM che scegli.

```bash
pnpm install && pnpm check   # typecheck + test + lint + build
pnpm build                   # poi carica dist/ in chrome://extensions
pnpm setup:opencode          # opzionale: bridge per importare chiavi da opencode
```

Leggi **[GUIDA.md](GUIDA.md)** per architettura, setup, scorciatoie e roadmap.
Stato CI: `pnpm check` verde (typecheck + 347 test vitest + lint + build), e2e smoke
con a11y, coverage `src/shared` > 90%, audit + secret-scan + size + links attivi.
Per validare il branch: `pnpm check`, `pnpm test:e2e` e la CI sull'ultimo SHA prima
di creare un pacchetto beta. La pseudonimizzazione non copre automaticamente nomi,
testi liberi e file binari.
Contribuire: vedi **[CONTRIBUTING.md](CONTRIBUTING.md)**.
