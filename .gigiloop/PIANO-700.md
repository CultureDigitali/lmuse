# PIANO-700 — Loop 7 (v0.8.0): e2e reali, tool iframe/download, UX log

Obiettivo: e2e con interazioni reali (non solo smoke), nuovi tool browser_download
e iframe snapshot, ricerca nel log, overlay scorciatoie, stima token pre-run,
validazione modello con cache discovery, auto-lock chiave di sessione.

Baseline: HEAD f9cda22, 251 test verdi, `pnpm check` verde.

## A. e2e con interazioni reali — 1–20
1. scripts/e2e-smoke.mjs: apri settings via bottone ⚙ (click reale).
2. e2e: provider select renderizza optgroup Cloud/Gateway/Locali.
3. e2e: cambio provider reale → model-tag aggiornato.
4. e2e: badge versione `v0.8.0` presente nel header.
5. e2e: card opencode renderizzata (fieldset + bottoni).
6. e2e: bottone discovery ⟳ presente accanto al modello.
7. e2e: Esc chiude le impostazioni (keydown reale).
8. e2e: hint rotazione chiave assente con chiave nuova.
9. e2e: log vuoto → nessun errore console.
10. e2e: composer con contatore caratteri.
11. e2e: a11y axe su settings aperto (nuovo stato).
12. e2e: screenshot finale per verifica visiva (salvato, non confronto).
13. e2e helper: findButton(text) riusabile.
14. e2e helper: openSettings() riusabile.
15. e2e: zero errori pagina su ogni stato (home + settings).
16. e2e: manifest versione coerente con package.json (già, mantiene).
17. e2e: service worker attivo dopo interazioni (no crash).
18. e2e: tempo totale < 30s.
19. e2e: exit code 0 solo se tutti i check passano (già, mantiene).
20. Docs GUIDA: nota e2e espanse.

## B. Nuovi tool: browser_download + iframe snapshot — 21–36
21. `browser_download`: click su ref di un link download + attesa evento.
22. Content: LMUSE_DOWNLOAD (click + listener download nel page world).
23. Reply download: { ok, filename? }.
24. `browser_iframe_snapshot`: snapshot di iframe stesso-origin (srcdoc/embedded).
25. Content: LMUSE_IFRAME_SNAPSHOT con selezione iframe per indice.
26. Guardia: iframe cross-origin → errore chiaro (non tentare).
27. Budget: i nuovi tool nel budget centrale (nessuna eccezione).
28. Approval: browser_download → sensitive; iframe_snapshot → off (solo lettura).
29. Agent prompt: descrizione nuovi tool (26 → 28? totale).
30. Test content: download (jsdom, stub click/anchor).
31. Test content: iframe snapshot stesso-origin + cross-origin errore.
32. Test: approval policy per nuovi tool.
33. tools.ts: count aggiornato (24 → 26).
34. i18n: nessuna stringa nuova (tool log generico) — verifica.
35. e2e: smoke invariato verde.
36. GUIDA tabella tool aggiornata.

## C. Stima token pre-run + validazione modello — 37–48
37. estimateTokens(text): chars/4 approssimazione (pura, testata).
38. Panel: stima token del task prima dell'avvio (sotto il composer).
39. Avviso se stima > maxTokensPerRun/2 (hint, non blocco).
40. Validazione modello: se cache discovery esiste e modello assente → warn.
41. Panel: warn "modello non in lista" (con link discovery).
42. i18n: token_estimate, model_not_in_list.
43. Test estimateTokens: 0, 4 char, 4000 char.
44. Test: soglia avviso calcolata pura.
45. i18n parità it/en.
46. e2e: stima visibile con task scritto.
47. GUIDA nota stima.
48. PRIVACY: nessun dato inviato per la stima (solo locale).

## D. UX log: ricerca + collapse — 49–52
49. Search nel log (input filtro testo, combina con filtro kind).
50. Test: filtro combinato pure (extract? in App, test via grep manuale).
51. i18n: search_log.
52. e2e: search input presente.

## E. Overlay scorciatoie — 53–58
53. Bottone ⌨ nel header → overlay lista scorciatoie.
54. Contenuto: Ctrl+K, Esc, Ctrl+Shift+L, Ctrl+Shift+X da manifest commands.
55. i18n: shortcuts_title già presente — riusa.
56. e2e: bottone ⌨ presente e overlay apre/chiude.
57. a11y: overlay con role dialog + aria-label.
58. GUIDA nota scorciatoie.

## F. Auto-lock chiave sessione — 59–68 ✅ fatto
59. ✅ Setting `sessionLockMin` (default 0 = mai, range 0–120).
60. ✅ settings.ts: campo + sanitize + default.
61. ✅ Alarm dedicato `lmuse-lock` + marker attività in session storage.
62. ✅ Worker: `checkSessionLock` → `clearSessionKeys` + broadcast.
63. ✅ Panel: select 0/5/15/30/60 min + ping attività throttled (30s).
64. ✅ Test sanitize: default 0, clamp 0-120.
65. ✅ Test `lock.ts` puro: 10 casi (soglia, esattamente-soglia, orologio indietro).
66. ✅ i18n: session_lock_label/off/min it+en.
67. ✅ Semantica esplicita: auto-lock agisce SOLO su storage.session
       (chiavi ricordate in local non sono toccate) — etichetta "solo sessione"
       + test di regressione. Difetto trovato in red-team.
68. ⬜ PRIVACY/GUIDA: da scrivere alla chiusura.

## Extra trovati in red-team (fuori piano)
- ✅ Regressione `browser_iframe_snapshot`: `acted()` allegava lo snapshot della
  pagina principale, azzerando i refMap → l'iframe era inutile. Fix + 5 test.
- ✅ Policy approval mancante: `browser_download` non era in nessuna policy.
  Ora `sensitive`; `browser_iframe_snapshot` classificata sola lettura.
- ✅ Nuovo file `src/background/tools.test.ts` (era il gap di copertura sui tool).

## G. opencode minor — 69–72
69. Card opencode: lista provider trovati (nomi leggibili, non solo conteggio).
70. Import: dopo import, messaggio con provider importati per nome.
71. Test: mapping nomi leggibili (opencode.test).
72. GUIDA aggiornata.

## H. Test + i18n — 73–90
73. pnpm vitest: ≥ 251 + nuovi (~25) verdi.
74. Coverage soglie 85/85/80 (src/shared) mantenute.
75. settings.test: sessionLockMin.
76. log-export.test: (già) — mantiene.
77. opencode.test: nomi leggibili.
78. estimate test.
79. content test: download/iframe.
80. e2e helper tests (findButton).
81. i18n test parità (regressione).
82. PanelToSwSchema test: (già) — mantiene.
83. tools count test aggiornato.
84. Red-team: no segreti nei log di e2e.
85. No console.log in src/.
86. No eval/innerHTML (già garantito, verifica con grep).
87. typecheck verde.
88. lint verde.
89. build verde.
90. check-size verde (background < 500 KB).

## I. Q + docs + release — 91–100
91. pnpm check completo.
92. pnpm test:e2e (con interazioni reali) verde.
93. check-links ok.
94. check-chromium-age ok.
95. GUIDA.md aggiornata (e2e, tool, stima, lock, scorciatoie).
96. PRIVACY.md auto-lock; SECURITY invariata (nessun nuovo permesso).
97. README/STORE: 26 tool, stima token, e2e reali.
98. CHANGELOG 0.8.0 + bump versione package/manifest/tooltip.
99. AGENTS.md aggiornato se serve.
100. Commit + tag v0.8.0 + GitHub release.
