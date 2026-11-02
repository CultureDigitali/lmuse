# PIANO-800 — Loop 9 (v0.9.0): revisione avversariale completa + 3 funzionalità

Obiettivo: (1) team di agenti avversariali su tutto il codice, i test e le
documentazioni; (2) triage rigoroso: ogni finding va verificato contro il codice
prima di essere corretto; (3) tre funzionalità nuove: modelli di task, overlay
scorciatoie, `browser_drag` (27° tool).

Baseline: HEAD b742f18 (v0.8.1), 323 test verdi, `pnpm check` verde, CI verde.

Stato al 2 nov 2026: **completato**. A/B: red-team + fix con regressioni (query
sensibili, back/forward, clipboard-write, TOCTOU, allowlist, hostOnly, iframe) e
run-marker integrati (stop-text/circuit/budget abortiscono davvero il run).
C: modelli di task con nome + migrazione. D: overlay scorciatoie con Esc/click
fuori. E: `browser_drag` (27° tool). F: docs + release 0.9.0. 347 test,
`pnpm check` verde, e2e con overlay e toggle free.

## A. Team avversariale — 1–6

1. Baseline: `pnpm check` + `pnpm test:e2e` verdi su HEAD.
2. Red-team sicurezza/privacy: `src/background`, manifest, CSP, bridge opencode.
3. Review correttezza worker: ciclo di vita MV3, race, errori ingoiati, STOP.
4. Review sidepanel + shared: stato React, storage, schemi zod, i18n, regex PII.
5. Review prodotto/docs: README, GUIDA, PRIVACY, SECURITY, CHANGELOG, REPORT.
6. QA copertura: file senza test, percorsi critici non testati, buchi e2e.

## B. Triage — 7–10

7. Verifica ogni finding contro il codice: niente fix su ipotesi non confermate.
8. Classifica ogni finding: blocker / medio / respinto (con motivo scritto).
9. Fix dei blocker con test di regressione che falliscono senza il fix.
10. Fix dei medi; i respinti vengono documentati con la ragione.

## C. Funzionalità 1: modelli di task — 11–20

11. `TEMPLATES_KEY` + tipo `TaskTemplate` in `src/shared/settings.ts`.
12. `sanitizeTemplate` + CRUD puro in shared (id, nome, testo, max 20, FIFO).
13. Test unitari shared: sanitize, cap 20 con eviction, delete per id, roundtrip.
14. Test storage con `chrome` stubbato (pattern di `settings-io.test.ts`).
15. UI pannello: bottone Modelli nel composer, popover con lista.
16. UI: click su un modello → testo nel composer.
17. UI: salva il testo corrente come modello (input inline, mai `prompt()`).
18. UI: elimina modello (bottone con `aria-label`).
19. e2e: salva modello, ricarica il pannello, riutilizzalo dal popover.
20. i18n: stringhe nuove in italiano in `src/shared/i18n.ts`.

## D. Funzionalità 2: overlay scorciatoie — 21–27

21. Inventario delle scorciatoie vere esistenti (grep dei keydown in App.tsx).
22. UI: bottone «?» nell'header del pannello (con `aria-label`).
23. UI: overlay `role="dialog"` con la lista delle scorciatoie vere.
24. Chiusura: Esc, click fuori, bottone ✕; focus gestito.
25. e2e: il bottone apre l'overlay, Esc lo chiude.
26. GUIDA: tabella delle scorciatoie.
27. Riservato: estensioni future.

## E. Funzionalità 3: browser_drag — 28–37

28. `actions.ts`: `dragElement(from, to)` con sequenza di eventi mouse sintetici.
29. Test jsdom: mousedown su sorgente, mousemove di interpolazione, mouseup sul
    bersaglio con coordinate coerenti con `getBoundingClientRect`.
30. Content script: messaggio `LMUSE_DRAG { fromRef, toRef, docIndex }`.
31. Tool `browser_drag`: zod, approval, `assertTabUnchanged`, `tabForAction`,
    allowlist.
32. Test tool: conferma richiesta, allowlist, messaggio al content corretto.
33. Limitazione dichiarata nella descrizione: eventi mouse, non DnD HTML5 nativo.
34. SECURITY: `browser_drag` nelle difese (approval) e nelle minacce note.
35. GUIDA: sezione tool, totale 27.
36. README/REPORT: conteggi 26 → 27.
37. e2e: solo unit test; il drag reale resta fuori dallo smoke (dichiarato).

## F. Test, docs, release — 38–50

38. `pnpm test:coverage` verde con le soglie esistenti.
39. e2e completo verde (21 controlli attesi).
40. CHANGELOG 0.9.0 con data, funzionalità e fix.
41. REPORT: ciclo 9, conteggi aggiornati (tool, test, e2e).
42. PRIVACY: solo se un fix la tocca.
43. `pnpm check-links` ok.
44. `pnpm check` verde.
45. Bump 0.9.0 in package.json + manifest (versione e tooltip) + README.
46. `pnpm release`: zip + sha256 riportato nel REPORT.
47. Commit + push su pubblico e privato.
48. CI verde su `main` di entrambi i repo (privato: nota billing se ancora bloccato).
49. Tag `v0.9.0` + GitHub release con note e asset.
50. Chiusura PIANO-800 con esito per voce.
