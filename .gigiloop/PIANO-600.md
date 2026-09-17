# PIANO-600 — Loop 6 (v0.7.0): performance, discovery e profondità

Obiettivo: ridurre il peso del service worker (1.09 MB → lazy-load per provider),
aggiungere model discovery live, coda task, export log, nuovi tool browser
(download/clipboard/hover/drag/iframe) e approfondire l'integrazione opencode.

Baseline: `pnpm check` verde (232 test), HEAD 5786811, release v0.6.0 pubblicata.

## A. Performance bundle (dynamic import provider) — 1–14
1. providers.ts: mappa factory lazy (`() => import('@ai-sdk/xxx')`).
2. createModel diventa async, un solo chunk per provider caricato on-demand.
3. Vite manualChunks disattivato per provider (default dynamic chunks ok).
4. worker: await createModel nei due call-site (testConnection, startRun).
5. agent.ts: firma runTask invariata (riceve già il modello pronto).
6. Test factory: createModel async per tutti i 25 provider.
7. Test: chunk non caricati finché non servono (mock import counter).
8. Budget background.js: soglia 1300 → 700 KB.
9. Budget sidepanel invariato (< 400 KB).
10. Misura reale post-build: background < 700 KB.
11. e2e: service worker registrato e health ok.
12. Test connessione con chunk lazy (mock).
13. Nessun await seliale aggiunto nel path RUN (solo i 2 call-site).
14. Docs: GUIDA nota performance.

## B. Model discovery live — 15–26
15. GET {baseUrl}/models per provider OpenAI-compatibili (openrouter, nvidia, opencode, github, baseten, sambanova, ollama, lmstudio, custom).
16. `fetchModels(providerId, apiKey, baseUrl)` in background, timeout 10s.
17. Risposta validata: array id stringhe, max 500, dedup, sort.
18. Salvataggio in storage.local `lmuse.models.v1` (mappa providerId → lista).
19. loadStoredModels / saveModelsCache pure + test.
20. Panel: bottone "Aggiorna modelli" accanto al campo modello (solo provider compatibili).
21. Datalist: cache locale + preset catalogo uniti.
22. Errori: messaggio italiano (401 → chiave, rete → riprova).
23. Test fetchModels con fetch mockato (ok, 401, malformed).
24. Test cache roundtrip e cap 500.
25. i18n it/en: update_models, updating, models_updated, models_error.
26. i18n test parità (regressione auto).

## C. Coda task — 27–38
27. Coda in storage.session `lmuse.queue.v1` (max 5, task troncati).
28. addToQueue / loadQueue / clearQueue + sanitizeQueue pure.
29. Worker: a fine run, se coda non vuota → avvia il prossimo (dopo cooldown).
30. Panel: se running e utente invia → proposta "Metti in coda" (banner, non auto).
31. Messaggio SW→Panel QUEUE_ADDED { position }.
32. Badge coda nel composer (n task in attesa).
33. Test sanitize: cap 5, trim, malformati filtrati.
34. Test worker: drain coda a fine run (fake timers).
35. Test: coda NON parte se STOP durante run precedente.
36. i18n: queued, queue_added, queue_empty.
37. UX: banner coda con dismiss.
38. Docs GUIDA sezione coda.

## D. Export log + persistenza run — 39–46
39. exportLog(list) → file .md scaricabile (chrome.downloads? no: anchor blob).
40. Header md con data, provider, modello (mai chiave).
41. Bottone "Scarica log" già presente → wired a exportLog.
42. Test exportLog: markdown valido, header, PII redatta opzionale.
43. Test: nessun segreto nel file.
44. i18n già presente (download_log) — verificata.
45. GUIDA nota export.
46. PRIVACY: file log resta locale (nessun upload).

## E. Nuovi tool browser — 47–62
47. `browser_hover` (hover su ref, content actions).
48. `browser_drag` (drag da ref a coordinate/ref).
49. `browser_clipboard_write` (testo negli appunti del tab).
50. `browser_clipboard_read` (appunti → agente, permission prompt).
51. `browser_download` (click su link download + attesa file nel download shelf).
52. `browser_iframe_snapshot` (snapshot di un iframe src compatibile stesso-origin).
53. Content: azioni hover/drag/clipboard/iframe in actions.ts.
54. Budget tool-call: +5 nuovi nel budget map.
55. Approval: clipboard_read → sensitive; drag → sensitive; hover → off.
56. Agent prompt: descrizione nuovi tool.
57. Test content: hover/drag/clipboard (jsdom, stub execCommand/navigator.clipboard).
58. Test budget: nuovi tool nel budget.
59. Test approval: policy per nuovi tool.
60. i18n: nessuna stringa nuova necessaria (tool log generico).
61. e2e: smoke invariato.
62. GUIDA tabella tool aggiornata (21 → 26).

## F. opencode deepening — 63–72
63. Status opencode nel header pannello (dot verde se bridge ok, cached 60s).
64. bridgeCall cache in memoria panel (no doppio ping).
65. `opencode models` via bridge comando 'models'? No: zen /models già in B. Skip.
66. Import: dopo import, opzione "usa subito" → cambia provider a quello importato scelto.
67. Card opencode: lista provider trovati con nome leggibile.
68. Selezione singola provider da card → set provider+chiave.
69. Test: selezione da card applica provider+chiave.
70. i18n: opencode_use, opencode_providers_list.
71. GUIDA: aggiornata flusso opencode (Rileva → Importa → Usa).
72. PRIVACY invariata (nessun nuovo dato).

## G. Sicurezza / privacy — 73–80
73. optional_host_permissions: roadmap → valutazione reale, resta <all_urls> (decisione documentata).
74. Rotazione chiave: hint età chiave (>90gg → suggerimento rotazione, solo locale).
75. keySavedAt in storage, aggiornato a ogni saveApiKey.
76. loadKeyAge pure + test.
77. Panel: hint rotazione nella sezione chiave.
78. i18n: key_age_warn.
79. Test: nessun valore chiave nell'hint (solo età).
80. SECURITY: nota rotazione.

## H. UX polish — 81–88
81. Overlay scorciatoie (Ctrl+Shift+L, Ctrl+Shift+X, Ctrl+K, Esc) nel footer ⚙.
82. i18n: shortcuts_title, shortcuts list.
83. Esc chiude settings/approval (già? verifica, se manca aggiungi).
84. Focus visible coerente (a11y, e2e axe già copre).
85. Contatore caratteri task già presente — verifica colori soglia.
86. Spinner coerente con theme.
87. Test i18n parità.
88. e2e a11y 7/7.

## I. Test + coverage — 89–94
89. pnpm vitest run: ≥ 232 + nuovi (~35) verdi.
90. Coverage soglie 85/85/80 mantenute (src/shared).
91. settings.test: coda + modelli cache + key age.
92. opencode.test: card/use aggiunte.
93. tools budget test aggiornato.
94. exportLog test.

## J. Q + docs + release — 95–100
95. pnpm check verde completo.
96. pnpm test:e2e 7/7.
97. GUIDA.md: performance + coda + tool 26 + discovery.
98. PRIVACY/SECURITY aggiornate; CHANGELOG 0.7.0 + bump versione + release zip dinamico.
99. README/STORE aggiornati (26 tool, coda, discovery, opencode usa).
100. Commit + tag v0.7.0 + GitHub release.
