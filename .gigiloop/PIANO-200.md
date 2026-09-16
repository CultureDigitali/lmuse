# Piano 100 migliorie v2 — lmuse 0.3.0 (GigiLoop loop 2)

Obiettivo: human-approval per azioni sensibili, content script on-demand, resilienza run,
trasparenza costi, suite test estesa. [x] = applicata e verificata.
Tipi: [code] modifica codice, [audit] verifica con comando/grep + documento.

## Sicurezza II (S101–S125)

- [x] S101 [code] Content script: verifica `sender.id === chrome.runtime.id`, ignora altri mittenti
- [x] S102 [code] Iniezione on-demand: via `content_scripts` statico, inject con `scripting.executeScript` al primo uso nel run
- [x] S103 [code] `ensureContentScript(tabId)`: inject + retry singolo se il primo invio fallisce
- [x] S104 [code] Setting `approval`: 'off' | 'sensitive' (default) | 'all'
- [x] S105 [code] `shouldApprove(tool, args, ctx)` pura: sensitive = navigate-nuovo-dominio, type submit, tab_focus esterno
- [x] S106 [code] Protocollo APPROVAL_REQUEST/APPROVE/DENY su Port validato con zod
- [x] S107 [code] Tool in attesa di approval abortibile da STOP (niente hang)
- [x] S108 [code] Approval con timeout 120s → deny di default
- [x] S109 [code] Safety floor: type+submit richiede conferma anche con policy 'off' (blocco password resta)
- [x] S110 [code] Le decisioni di approval finiscono nel log (approvato/negato + motivo)
- [x] S111 [code] Cooldown 5s tra RUN consecutivi (`canStartRun` pura + messaggio chiaro)
- [x] S112 [code] `isPlausibleKey`: chiave < 8 char rifiutata con errore chiaro
- [x] S113 [code] Navigate rifiuta URL con credenziali `user:pass@host`
- [x] S114 [code] Content `type`: testi > 2000 char → errore esplicito invece di slice silenzioso
- [x] S115 [code] `browser_tab_focus`: id tab non numerico/negativo rifiutato prima delle API
- [x] S116 [audit] `externally_connectable` assente: nessuna pagina web può messaggiare l'estensione
- [x] S117 [audit] CSP `extension_pages` copre anche il side panel (stesso contesto)
- [x] S118 [code] CI: `pnpm audit --audit-level=high` fallisce su vulnerabilità alte/critiche
- [x] S119 [code] CI: secret-scan grep su pattern chiave live (`sk-[A-Za-z0-9]{20,}`, `xox-`, `ghp_`)
- [x] S120 [code] `rel="noreferrer noopener"` su tutti i link esterni del panel (audit)
- [x] S121 [audit] Nessuna chiave/secret hardcoded nel codice (grep + CI secret-scan)
- [x] S122 [code] Approval richiesta include dominio target e azione in chiaro (no ambiguità)
- [x] S123 [audit] `scripting` usato solo per file locali (`files:`, mai `func:` con stringhe)
- [x] S124 [code] STOP durante approval pending sblocca subito il tool in attesa
- [x] S125 [code] SECURITY.md: tabella rationale permessi + sezione approval

## Privacy II (P126–P145)

- [x] P126 [code] Header snapshot redatto: `maskUrlTokens` su URL, `maskPii` su titolo (`formatSnapshotHeader` pura)
- [x] P127 [code] `tabs_list`: URL redatti + titoli troncati/mascherati
- [x] P128 [code] Setting `privacyHostOnly`: snapshot mostra solo origin+path, niente query
- [x] P129 [code] Strip parametri tracking (`utm_*`, `gclid`, `fbclid`, ...) prima di navigare
- [x] P130 [code] Cronologia: voci troncate a 200 char in storage
- [x] P131 [code] Setting `keepHistory` on/off (off = nessuna persistenza task)
- [x] P132 [code] Usage stats locali: `{runs, totalTokens}` + reset con cancella-tutto
- [x] P133 [code] Banner visibile quando la redazione PII è OFF (niente silencioso)
- [x] P134 [code] Export impostazioni include anche approval/policy (mai la chiave)
- [x] P135 [audit] Elenco chiavi storage aggiornato in PRIVACY.md (nuove chiavi incluse)
- [x] P136 [code] Snapshot jsdom: password mai esposta anche con `maskPii=false`
- [x] P137 [code] Snapshot jsdom: email redatta con mask on, intatta con mask off
- [x] P138 [code] `maskPii` applicata anche agli URL restituiti da `tabs_list`
- [x] P139 [audit] Nessun nuovo permesso introdotto dal loop 2 (diff manifest)
- [x] P140 [code] Inbox: non salva il testo del task, solo risultato+passi (audit codice)
- [x] P141 [code] Clear-all cancella anche usage stats e flag onboarding
- [x] P142 [audit] `captureVisibleTab` chiamato solo su azione esplicita dell'agente (grep)
- [x] P143 [code] Panel: la chiave non compare mai nel DOM in chiaro senza reveal (audit codice)
- [x] P144 [code] `allowedDomains` normalizzato (lowercase, trim) al salvataggio
- [x] P145 [code] PRIVACY.md: sezione loop-2 (approval, hostOnly, tracking-strip, usage, on-demand)

## Robustezza II (R146–R170)

- [x] R146 [code] Azioni riuscito → snapshot aggiornato auto-allegato (niente roundtrip)
- [x] R147 [code] `mapTabError` pura: tab chiuso/inesistente → messaggio chiaro (testata)
- [x] R148 [code] Click su pagina senza cambiamenti: hint "nessun cambio rilevato, prova screenshot"
- [x] R149 [code] Navigate: segnala redirect (URL finale ≠ target)
- [x] R150 [code] Type: conferma caratteri applicati (content restituisce lunghezza valore)
- [x] R151 [code] Scroll: restituisce % scroll raggiunta
- [x] R152 [code] Snapshot vuoto (0 elementi): suggerisce screenshot (pagina canvas/grafica)
- [x] R153 [code] Run state in session (`RUN_STATE_KEY`): task+inizio salvati a inizio run, puliti a fine
- [x] R154 [code] Panel all'avvio: se run state orfano (SW riavviato) → banner + offerta Riprova
- [x] R155 [code] Pulsante Riprova ultimo task dopo errore/interruzione
- [x] R156 [code] DONE include usage (token input/output): agent ritorna `result.usage`
- [x] R157 [code] Quota storage: save con try/catch → banner se spazio esaurito
- [x] R158 [code] `waitForTabComplete` copre anche `chrome.tabs.get` che rigetta (tab chiuso)
- [x] R159 [code] Test `withTimeout`/dispose con fake timers
- [x] R160 [code] Test `shouldApprove` (matrice policy × tool × contesto)
- [x] R161 [code] Test `formatSnapshotHeader` (mask on/off, hostOnly)
- [x] R162 [code] Test tracking-strip + userinfo-reject in urlGuard
- [x] R163 [code] Test usage-stats merge + `canStartRun` + `isPlausibleKey`
- [x] R164 [code] Test cronologia (truncate 200, keepHistory off, dedup)
- [x] R165 [code] Test i18n: it+en con stesse chiavi
- [x] R166 [code] Test `PanelToSwSchema` esteso (APPROVE/DENY/approvazioni malformate)
- [x] R167 [code] Elapsed timer: `formatElapsed` pura + test
- [x] R168 [code] CI: check bundle-size (`scripts/check-size.mjs`, fail oltre soglia)
- [x] R169 [code] CI: aggiunge `lint` + `format:check` (gap loop 1)
- [x] R170 [audit] Zero TODO/FIXME/XXX nel codice (grep, rimossi o convertiti in issue)

## Qualità II (Q171–Q180)

- [x] Q171 [code] jsdom + `snapshot.test.ts` (ref stabili, limite nodi, heading, marker password)
- [x] Q172 [code] Coverage v8 + `test:coverage`, soglia 85% su `src/shared`
- [x] Q173 [code] `scripts/check-size.mjs` + `scripts/verify-dist.mjs` (manifest+file dist)
- [x] Q174 [code] `release` esegue anche verify-dist prima dello zip
- [x] Q175 [code] Dependabot config (aggiornamenti settimanali pnpm)
- [x] Q176 [code] AGENTS.md: comandi, convenzioni, dove mettere test
- [x] Q177 [code] `.gitattributes` (endings, linguist) per diff puliti
- [x] Q178 [code] Script `check` esteso: typecheck + test + lint + build
- [x] Q179 [code] Versione 0.3.0 coerente package/manifest/CHANGELOG
- [x] Q180 [code] `pnpm outdated` valutato, minor sicure aggiornate

## Documentazione II (D181–D190)

- [x] D181 [code] GUIDA: sezione approval (policy, safety floor, timeout)
- [x] D182 [code] GUIDA: iniezione on-demand + cosa cambia nei permessi
- [x] D183 [code] GUIDA: troubleshooting esteso (SW dormiente, inbox orfana, retry)
- [x] D184 [code] GUIDA: diagramma flusso approval
- [x] D185 [code] GUIDA: sezione costi/token + provider locali
- [x] D186 [code] README: permessi spiegati in 5 righe + link PRIVACY
- [x] D187 [code] CHANGELOG 0.3.0 completo
- [x] D188 [code] Commenti architetturali nuovi file (approval, ensure-inject, run-state)
- [x] D189 [code] GUIDA: tabella impostazioni completa (tutte le chiavi, default)
- [x] D190 [code] SECURITY.md: aggiornata con minacce loop-2 valutate (injection on-demand, approval-bypass)

## UX II (U191–U200)

- [x] U191 [code] Banner approval: azione+dominio, Approva/Nega, countdown 120s
- [x] U192 [code] Footer run: passi · token · tempo trascorso
- [x] U193 [code] Pulsante "Riprova" dopo errore + da banner run orfano
- [x] U194 [code] Toolbar log: copia log + pulisci log
- [x] U195 [code] Onboarding first-run: welcome + checklist (provider→chiave→prova task)
- [x] U196 [code] Footer impostazioni: statistiche uso locali (run · token)
- [x] U197 [code] Toggle `privacyHostOnly` + `keepHistory` + select `approval` nelle impostazioni
- [x] U198 [code] Stato vuoto cronologia: testo dedicato (non solo assenza)
- [x] U199 [code] Feedback "Cronologia svuotata" dopo pulizia (conferma visiva)
- [x] U200 [code] Focus automatico sul banner approval quando appare (a11y)

## Report finale

(da compilare a fine loop)

## Report finale

- 100/100 voci applicate e verificate (2026-09-16). Score post-reconcile: 9.0/10.
- `pnpm check` verde: typecheck + 130/130 test + lint + build. Coverage src/shared:
  93% stmts / 92% branch / 97% funcs (soglie 85/85/80).
- `pnpm release` → `release/lmuse-0.3.0.zip` (370 KB, verify-dist + check-size ok).
- Audit: zero console.log (solo fixture test), zero sink XSS nel codice shipped,
  zero telemetria, zero web storage di pagina, nessun segreto, audit pulito,
  nessun nuovo permesso (solo rimozione content_scripts).
- Fix reali emersi: snapshot primo-uso senza inject (red-team), `%20` negli script
  (path con spazi), global Node per eslint negli script, `URL` token sempre redatti.
- Rischi residui in SECURITY.md (prompt injection, approval-confusion, `<all_urls>`, worker MV3).
