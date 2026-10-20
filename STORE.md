# Chrome Web Store — listing lmuse (pronto da incollare)

> Stato: **pronto per la submission come “Unlisted / trusted testers”**.
> Ultimo aggiornamento: 19 ottobre 2026 · candidato: `release/lmuse-0.8.1.zip`

## Scheda

- **Nome**: lmuse — AI browser agent (BYOK)
- **Descrizione breve (≤132 caratteri)**:
  `Un agente AI che usa il browser per te, con la tua chiave LLM. 25 provider, conferme umane, zero telemetria.`
- **Categoria**: Productivity
- **Lingue**: Italiano, English
- **Privacy policy**: https://culturedigitali.github.io/lmuse/privacy.html
- **Supporto**: https://github.com/CultureDigitali/lmuse/issues
- **Homepage**: https://github.com/CultureDigitali/lmuse

## Descrizione estesa (testo semplice, senza markdown)

```
lmuse è un agente AI che lavora dentro il tuo browser. Descrivi un task in
linguaggio naturale — riassumi questa pagina, trova un link, compila un modulo,
confronta prezzi — e lmuse usa gli strumenti del browser per portarlo a termine.

USI LA TUA CHIAVE
Scegli tra 25 provider: OpenAI, Anthropic, Google Gemini, xAI, Azure, DeepSeek,
Groq, Cerebras, Mistral, Cohere, DeepInfra, Fireworks, Perplexity, Together AI,
Hugging Face, NVIDIA NIM, SambaNova, Baseten, GitHub Models, OpenRouter,
OpenCode Zen, Vercel AI Gateway, Ollama, LM Studio o qualsiasi endpoint
OpenAI-compatibile. La chiave resta sul tuo computer, in un keystore locale
per provider. Nessun server nostro, nessuna telemetria, nessun tracciamento.

CONTROLLO UMANO
Le azioni sensibili (navigazione, invio moduli, cambio scheda, download,
lettura appunti) richiedono la tua conferma, con policy configurabile
(mai / sensibili / tutte). STOP sempre a portata di mano.

PRIVACY
Redazione automatica di email, IBAN, carte, numeri e token negli URL prima
di inviare lo snapshot al modello. Campi password mai letti né compilati.
Elenco di domini consentiti per restringere il perimetro. “Cancella tutti i
dati” elimina chiavi, cronologia e impostazioni.

FUNZIONI
- 26 strumenti browser: snapshot, click, digitazione, select, hover, attesa,
  find, tabelle, query CSS, scroll, screenshot (anche ritagliati), appunti,
  download, iframe, gestione schede.
- Streaming della risposta, stop-text e token guard per controllare i costi.
- Task programmati, coda task, template, export log markdown.
- Model discovery: legge la lista modelli dal provider con un click.
- Import opzionale delle credenziali già configurate in opencode (bridge locale
  installato separatamente, senza rete).
- Interfaccia italiano/inglese, tema chiaro/scuro.

REQUISITI
Serve una chiave API di un provider supportato (o un modello locale con
Ollama / LM Studio). lmuse non include chiavi e non rivende accesso ai modelli.
```

## Screenshot (1280×800, in `store/`)

1. `store/screenshot-1.png` — pannello con task, template e cronologia.
2. `store/screenshot-2.png` — impostazioni provider/modello/chiave + card opencode.

## Giustificazione permessi (una per campo della dashboard)

| Permesso          | Testo da incollare                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`         | Salva impostazioni e chiavi API esclusivamente sul dispositivo dell'utente (`chrome.storage`), senza inviarle a server dello sviluppatore.                                                                                                       |
| `scripting`       | Inietta il content script solo quando l'utente avvia un task, per leggere la pagina e compiere l'azione richiesta. Nessuna iniezione a riposo.                                                                                                   |
| `tabs`            | Legge URL/titolo della scheda attiva e può elencare, attivare, duplicare o chiudere schede quando il task lo richiede.                                                                                                                           |
| `activeTab`       | Opera sulla scheda attiva al momento dell'azione dell'utente, senza accesso preventivo.                                                                                                                                                          |
| `sidePanel`       | Mostra l'interfaccia dell'agente nel pannello laterale di Chrome.                                                                                                                                                                                |
| `alarms`          | Esegue i task programmati dall'utente (intervalli ≥ 60 minuti, massimo 5, solo locali).                                                                                                                                                          |
| `nativeMessaging` | Comunica con il bridge opencode, installato separatamente e su scelta dell'utente (`pnpm setup:opencode`), che legge in locale `~/.local/share/opencode/auth.json` e non usa la rete. Se il bridge non è installato il permesso non viene usato. |
| Host `<all_urls>` | L'agente deve poter operare sui siti che l'utente gli indica. Il perimetro è restringibile con l'elenco “Domini consentiti”; non c'è raccolta dati in background.                                                                                |

## Single purpose (dashboard)

> lmuse consente a un agente AI, configurato con la chiave LLM dell'utente, di
> eseguire task nel browser (leggere pagine, navigare, compilare moduli) con
> conferma umana sulle azioni sensibili.

## Data usage disclosure (dashboard)

- Raccolta dati da parte dello sviluppatore: **nessuna**.
- Autenticazione: la chiave API è fornita dall'utente e salvata solo in locale;
  viene inviata esclusivamente al provider LLM scelto dall'utente.
- Contenuto dei siti web: elaborato localmente e inviato al solo provider scelto
  per eseguire il task; redazione PII attiva di default.
- Vendita dati a terzi: **no**. Pubblicità: **no**. Telemetria: **no**.
- Codice remoto: **no** (tutto il codice è nel pacchetto; CSP `script-src 'self'`).

## Istruzioni per il revisore (dashboard → Test instructions)

```
lmuse è BYOK: richiede una chiave API di un provider LLM scelto dall'utente.
Non esiste un account lmuse e non ci sono server dello sviluppatore.

1. Apri il pannello laterale (icona nella toolbar o Ctrl/Cmd+Shift+L).
2. ⚙ → scegli un provider (es. OpenAI) → incolla una chiave valida → “Prova connessione”.
   In alternativa, con Ollama installato in locale: provider “Ollama (locale)”,
   base URL http://localhost:11434/v1, modello qwen3:8b, nessuna chiave.
3. Scrivi “Riassumi questa pagina in 3 punti” e premi Avvia.
4. Le azioni sensibili mostrano un banner di conferma con timeout.

Senza chiave è possibile verificare UI, permessi, impostazioni, policy di
conferma e redazione PII; l'esecuzione di un task richiede un provider.
Il codice è pubblico: https://github.com/CultureDigitali/lmuse
```

## Checklist prima dell'upload

- [x] Build verificata dal tag `v0.8.1` (323 test, e2e completo con provider mock, a11y 0 violazioni)
- [x] Pacchetto `release/lmuse-0.8.1.zip` (manifest 0.8.1, nessun sourcemap)
- [x] Privacy policy pubblicata (GitHub Pages)
- [x] Pagina di supporto + issue tracker
- [x] Screenshot 1280×800
- [x] Giustificazioni permessi e single purpose
- [ ] Account Chrome Web Store ($5 una tantum) — richiede l'utente
- [ ] Upload del pacchetto e compilazione Data usage nella dashboard
- [ ] Prova di accettazione con chiave reale su profilo pulito (utente)
