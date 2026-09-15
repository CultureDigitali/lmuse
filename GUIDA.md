# lmuse — Guida al progetto

Estensione Chrome (Manifest V3) che fa usare il browser a un'AI per svolgere task e operazioni,
stile BrowserOS / Comet / Operator. Usi **la tua chiave LLM**: nessun server nostro, nessuna
telemetria, la chiave resta in `chrome.storage` sul tuo PC (dettagli in [PRIVACY.md](PRIVACY.md)).

**Stack:** TypeScript + Vercel AI SDK v7 (`ToolLoopAgent`) + React (side panel) + Vite + Vitest.
Base scelta dopo analisi: Nanobrowser (l'unica estensione open BYOK) è fermo da nov 2025,
BrowserOS è un fork di Chromium con licenza AGPL (non riutilizzabile per un prodotto),
Stagehand/Skyvern richiedono un backend. Quindi scaffold nuovo, con `reference/nanobrowser`
tenuto solo come riferimento per le idee (es. distillazione DOM).

## Provider supportati (13)

| Provider                                                                      | Note                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| OpenAI, Anthropic, Google Gemini, xAI Grok, DeepSeek, Groq, Cerebras, Mistral | Package ufficiali AI SDK                                   |
| Azure OpenAI                                                                  | Richiede base URL risorsa + nome deployment come "modello" |
| OpenRouter                                                                    | Via OpenAI-compatibile, base URL precompilato              |
| Ollama, LM Studio                                                             | Locali, chiave opzionale, base URL precompilati            |
| Custom OpenAI-compatibile                                                     | Qualsiasi endpoint `/v1` (vLLM, Together, ecc.)            |

I nomi modello di default sono quelli correnti (set 2026), ma il campo modello è libero:
se esce un modello nuovo lo scrivi e funziona, senza aggiornare l'estensione.

## Struttura

```
public/manifest.json        Manifest MV3 (CSP, comandi tastiera, permessi, content script)
src/shared/settings.ts      Catalogo provider, settings, chiave/inbox/cronologia, protocollo
src/shared/pii.ts           Redazione PII + token URL (testato)
src/shared/urlGuard.ts      Blocco protocolli/host + allowlist (testato)
src/shared/errors.ts        Errori provider → italiano (testato)
src/shared/budget.ts        Budget tool-call per run (testato)
src/shared/i18n.ts          Stringhe UI it/en
src/background/providers.ts Crea il modello AI SDK dal provider configurato
src/background/tools.ts     9 tool browser con guardia centrale (budget/errori/timeout)
src/background/agent.ts     ToolLoopAgent + system prompt + timeout combinato
src/background/index.ts     Service worker: RUN/STOP, badge, inbox, comandi tastiera
src/content/snapshot.ts     Distilla il DOM in albero [ref] compatti (redatto)
src/content/index.ts        Esegue snapshot/click/digitazione/scroll su richiesta
src/sidepanel/              UI React: task, impostazioni, privacy, inbox, cronologia
sidepanel/index.html        Entry HTML (referrer no-referrer)
PRIVACY.md / SECURITY.md    Privacy e sicurezza documentate + audit
reference/nanobrowser/      Clone di riferimento (fuori git, opzionale):
                            `git clone https://github.com/nanobrowser/nanobrowser.git reference/nanobrowser`
```

## Flusso di un task

```
┌─────────┐  RUN(task)   ┌──────────────┐  prompt+tools  ┌───────────┐
│  Panel  │ ──────────→ │ ServiceWorker │ ────────────→ │   LLM     │
│  React  │ ←────────── │  (RUN/STOP,   │ ←──────────── │ (provider │
└─────────┘  STEP/DONE  │  badge,inbox) │  tool-call    │  scelto)  │
      ↑                 └──────┬───────┘               └───────────┘
      │ messaggi live          │ chrome.tabs.sendMessage (+timeout 10s)
      │                        ↓
      │                 ┌──────────────┐
      └──────────────── │Content script│ → snapshot redatto / click / type / scroll
         risultato      │ (isolated)   │
         in inbox       └──────────────┘
```

Scrivi la richiesta → il worker avvia `ToolLoopAgent` → l'agente cicla
`snapshot → azione → osserva` (max passi default 25, budget tool = passi×3) → vedi ogni
tool in diretta → resoconto finale. Se chiudi il pannello, il run prosegue e il risultato
ti aspetta nell'inbox. Lo screenshot va al modello come immagine (disattivabile); se il
modello non supporta le immagini, le impostazioni te lo segnalano.

## Cosa vede il modello

Per ogni passo: testo del task, snapshot testuale della pagina (URL, titolo, elementi
interattivi con ref), ed eventualmente screenshot PNG. **Di default redatto**: email,
IBAN, carte, telefoni/numeri lunghi e token negli URL compaiono come `[email]`, `[iban]`,
`[carta]`, `[numero]`, `[redatto]`; i campi password non compaiono mai (solo `[password]`).
Il modello non vede: la tua chiave API, le tue impostazioni, le altre schede (salvo
`tabs_list`/`tab_focus` espliciti), la cronologia dei task passati.

## Sicurezza & Privacy (implementato, v0.2.0)

- MV3 con CSP `script-src 'self'`, nessuna risorsa esposta al web, niente `eval`/`innerHTML`.
- Permessi minimi (niente `debugger` → niente banner "Chrome è controllato"); Chrome ≥ 116.
- Port verificata (`sender.id`), messaggi validati con zod, task max 4000 caratteri.
- Navigazione bloccata verso `javascript:/data:/file:/chrome:*`/Web Store + allowlist domini.
- Chiave in storage separato (locale o solo-sessione), mai loggata, mai esportata.
- Budget tool-call, timeout 10s/risposta e globale, STOP anche da tastiera.
- Dettagli e audit: [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md).

## Comandi tastiera

| Scorciatoia                        | Azione         |
| ---------------------------------- | -------------- |
| `Ctrl/Cmd + Shift + L`             | Apri lmuse     |
| `Ctrl/Cmd + Shift + X`             | Ferma il task  |
| `Ctrl/Cmd + K` (nel panel)         | Focus sul task |
| `Invio` / `Shift+Invio` (nel task) | Avvia / a capo |

## Sviluppo

Requisiti: Node ≥ 22 (`nvm use 22`), pnpm 9.

```bash
pnpm install        # installa dipendenze
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest (47 test)
pnpm lint           # eslint flat
pnpm format         # prettier
pnpm check          # typecheck + test + build
pnpm build          # compila in dist/
pnpm dev            # ricompila a ogni modifica (watch)
pnpm release        # check + zip di dist/ in release/
```

CI (GitHub Actions): install → typecheck → test → build a ogni push/PR.

**Caricare l'estensione in Chrome:**

1. `chrome://extensions` → attiva _Modalità sviluppatore_
2. _Carica estensione non pacchettizzata_ → seleziona la cartella `dist/`
3. Clicca l'icona lmuse (o `Ctrl/Cmd+Shift+L`) → pannello laterale
4. ⚙ → provider, modello, chiave API → scrivi un task e Avvia

## FAQ

- **Perché niente permesso `debugger`?** Il protocollo debugger mostra il banner "Chrome è
  controllato da un'estensione" e dà poteri enormi (rete, input raw). lmuse usa solo DOM +
  tab API: meno potente ma senza banner e con superficie minore.
- **Perché su `chrome://` o Web Store non funziona?** Chrome vieta i content script lì per
  policy; l'agente lo segnala con le cause possibili.
- **I miei dati vanno a Google/Chrome?** No: solo al provider LLM che configuri. Con
  Ollama/LM Studio restano sul tuo PC.
- **Il task continua se chiudo il pannello?** Sì, il run vive nel service worker; il
  risultato ti aspetta nell'inbox alla riapertura.
- **Posso fidarmi su siti con dati sensibili?** Usa redazione attiva (default), allowlist
  domini, provider locale; resta il rischio prompt-injection (vedi SECURITY.md).

## Roadmap

- [x] Cronologia task locale (max 20)
- [ ] Approvazione umana per azioni sensibili (`toolApproval: 'user-approval'`)
- [ ] Streaming dei token nel pannello (oggi: eventi per tool + risposta finale)
- [ ] `optional_host_permissions` con consenso per-sito (alternativa a `<all_urls>`)
- [ ] Modalità senza chiave via Chrome Built-in AI (Prompt API, Gemini Nano locale)
- [ ] Offscreen document per task molto lunghi (il worker MV3 può addormentarsi)
- [ ] Test e2e + pubblicazione Chrome Web Store (icone/store listing definitivi)

## Stato onesto

`pnpm check` verde (typecheck + 47 test + build), ESLint + Prettier verdi, CI attiva.
Il giro completo con chiave reale va provato caricando `dist/` in Chrome: se un provider
cambia formato risposta, si aggiusta in `providers.ts`.
