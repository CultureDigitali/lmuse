# PIANO-800 — Loop 8 (v0.9.0): least privilege, resilienza e collaudo reale

Obiettivo: portare la baseline 0.8.x verso una candidata pre-1.0 più sicura e verificabile.

## Priorità

1. Chiudere la 0.8.1 con CI verde sullo SHA esatto e collaudo manuale minimo.
2. Rendere `nativeMessaging` facoltativo e richiederlo solo quando l'utente usa il bridge OpenCode.
3. Valutare `optional_host_permissions` al posto di `<all_urls>`, mantenendo allowlist e trusted domains come policy applicative.
4. Rafforzare l'auto-lock: 0→5→0, riapertura pannello, restart worker, run attivo e multi-provider.
5. Introdurre test di prompt-injection con pagine ostili e gate più forti per azioni ad effetto esterno.
6. Prototipare una strategia robusta per task lunghi e restart MV3, evitando ripetizioni di azioni esterne.
7. Aggiungere un provider OpenAI-compatible finto locale per un e2e completo senza segreti: task → tool → risposta finale.
8. Estendere coverage e test ai moduli security-critical fuori da `src/shared`.
9. Preparare Chrome Web Store: disclosure privacy, permessi reali, listing, rollback, SBOM.
10. Rilasciare v0.9.0 solo con `pnpm check`, e2e Chrome for Testing, audit, secret scan, red-team e collaudo legati allo SHA finale.

## Gate v0.9.0

- CI osservata verde sul commit finale.
- Nessun high/critical dependency issue non motivato.
- Nessun segreto negli artifact.
- Test regressione auto-lock presente.
- E2E completo con provider finto locale.
- Red-team su prompt injection e azioni esterne.
- Documentazione coerente con codice e permessi.
- ZIP e checksum pubblicati dalla stessa revisione verificata.
