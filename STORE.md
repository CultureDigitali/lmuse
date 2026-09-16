# Chrome Web Store — bozza listing lmuse

> Da finalizzare prima della pubblicazione (screenshot + icone promozionali).

- **Nome**: lmuse — AI Browser Agent (BYOK)
- **Descrizione breve**: Un agente AI che usa il browser per te, con la tua chiave LLM.
- **Descrizione**: lmuse svolge task nel browser (ricerche, form, riassunti, confronti)
  usando il modello che scegli: OpenAI, Anthropic, Google, xAI, Ollama locale e altri 8.
  Conferma umana per azioni sensibili, redazione PII, nessuna telemetria.
- **Categoria**: Productivity
- **Lingue**: italiano, inglese
- **Permessi da giustificare**:
  - `tabs`/`activeTab`: leggere e operare sul tab attivo
  - `scripting`: analisi pagina on-demand durante i task
  - `storage`: impostazioni e chiave solo locali
  - host tutti i siti: operare dove l'utente chiede (allowlist opzionale)
- **Privacy**: nessun dato a terzi oltre al provider LLM scelto (vedi PRIVACY.md).
- **TODO pre-pubblicazione**:
  - [ ] 5 screenshot 1280×800 (task reale, approval, impostazioni, privacy, risultato)
  - [ ] Icona promozionale 440×280 + tile 920×680
  - [ ] Sito/pagina supporto + email
  - [ ] Prova su profilo Chrome pulito (tutte le policy approval)
