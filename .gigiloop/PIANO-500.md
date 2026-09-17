# PIANO-500 — Loop 5 (v0.6.0): provider planet + integrazione opencode

Obiettivo: portare lmuse da 13 a 25 provider LLM (incl. NVIDIA NIM e OpenCode Zen),
con keystore per-provider, e integrazione opzionale con opencode installato sul
sistema (bridge nativo che legge le credenziali opencode, solo su richiesta utente).

## A. Catalogo provider (settings.ts) — 1–25
1. Estendere `ProviderId` union con 12 nuovi id.
2. `ProviderDef.group` ('cloud' | 'local' | 'gateway').
3. Provider `nvidia` (NIM, openai-compatible, base https://integrate.api.nvidia.com/v1).
4. Modelli nvidia (llama 3.3 70b, deepseek-r1) + supportsVision.
5. keyUrl nvidia (build.nvidia.com).
6. Provider `opencode` (Zen gateway, base https://opencode.ai/zen/v1).
7. Modelli opencode da /zen/v1/models live (claude-sonnet-5, gemini-3.8-flash, gpt-5.5…).
8. keyUrl opencode (opencode.ai dashboard).
9. Provider `cohere` (command-a-03-2025).
10. Provider `deepinfra` (Llama-3.3-70B-Instruct).
11. Provider `fireworks` (llama-v3p3-70b-instruct).
12. Provider `perplexity` (sonar-pro/sonar, no vision).
13. Provider `togetherai` (Llama-3.3-70B-Turbo).
14. Provider `huggingface` (router HF, Llama-3.3-70B).
15. Provider `github` (GitHub Models, base https://models.github.ai/inference).
16. Provider `gateway` (Vercel AI Gateway).
17. Provider `baseten` (openai-compatible, inference.baseten.co/v1).
18. Provider `sambanova` (api.sambanova.ai/v1).
19. Gruppi assegnati a TUTTI i 25 provider.
20. keyUrl per ogni nuovo provider.
21. Flag `opencodeSource` (id credenziale opencode, es. 'xiaomi'→mappabili).
22. Test: sanitizeSettings accetta i 25 id.
23. Test: providerId ignoto → 'openai' (regressione).
24. Test: catalogo coerente (needsKey/group/supportsVision tipi).
25. Test: getProvider su ogni nuovo id non lancia.

## B. Factory modello (providers.ts) — 26–42
26. pnpm add @ai-sdk/cohere/deepinfra/fireworks/togetherai/perplexity/huggingface/gateway.
27. Caso `nvidia` via createOpenAICompatible.
28. Caso `opencode` via createOpenAICompatible (+header X-Title lmuse).
29. Caso `cohere` via createCohere.
30. Caso `deepinfra` via createDeepInfra.
31. Caso `fireworks` via createFireworks.
32. Caso `perplexity` via createPerplexity.
33. Caso `togetherai` via createTogetherAI.
34. Caso `huggingface` via createHuggingFace.
35. Caso `github` via createOpenAICompatible.
36. Caso `baseten` via createOpenAICompatible.
37. Caso `sambanova` via createOpenAICompatible.
38. Caso `gateway` via createGateway.
39. Test factory: createModel per 25 provider (non-lancia, provider id nel modello).
40. Test: azure senza baseUrl → errore italiano (regressione).
41. Test: custom senza baseUrl → errore italiano (regressione).
42. Errori provider mappati (errors.ts) anche per i nuovi nomi pacchetto.

## C. Keystore per-provider — 43–56
43. KEY_STORE_V2 = 'lmuse.keys.v2' (mappa providerId→key).
44. loadApiKey(providerId, rememberKey).
45. saveApiKey(providerId, key, rememberKey).
46. clearApiKey(providerId).
47. Migrazione lazy da lmuse.key.v1 → mappa per provider corrente.
48. clearAllData cancella anche v2.
49. Worker usa loadApiKey, non loadStoredKey.
50. Panel salva/carica chiave del provider selezionato.
51. Test: save/load roundtrip per 2 provider.
52. Test: migrazione da v1.
53. Test: rememberKey=false → storage session.
54. Test: clearApiKey solo quel provider.
55. Test: clearAllData wipe v2.
56. PRIVACY.md: keystore per-provider documentato.

## D. Bridge opencode (native messaging) — 57–78
57. native/lmuse-opencode-bridge.mjs: protocollo native messaging (len 32bit LE).
58. Comando 'list': legge ~/.local/share/opencode/auth.json.
59. Output { ok, providers: [{id, type}] } mai valori grezzi nei log.
60. Comando 'export': { ok, credentials: [{opencodeId, key}] } solo su richiesta.
61. Comando 'ping': { ok:true, version }.
62. Errori strutturati { ok:false, error: code }.
63. Path auth.json risolto da HOME, niente path arbitrari in input.
64. src/shared/opencode.ts: zod schema payload bridge.
65. mapOpencodeProviders(payload) → { providerId: key } per id lmuse noti.
66. Mappa opencode id → lmuse id (nvidia, openai, anthropic, google, xai, deepseek, groq, mistral, cerebras, opencode).
67. Test schema: payload valido/invalido.
68. Test mapping: id ignoti scartati, chiavi vuote scartate.
69. Test: chiavi mai in eccezioni/log.
70. scripts/setup-opencode-bridge.mjs: installa host manifest.
71. Supporto Chrome + Chromium dirs (mac/linux/win best-effort).
72. --extension-id per allowed_origins; fallback istruzioni.
73. scripts scripts: pnpm setup:opencode + uninstall.
74. Manifest: permesso 'nativeMessaging'.
75. Worker: OPENCODE_PING / OPENCODE_IMPORT via runtime.onMessage one-shot.
76. Errori bridge → i18n (non installato, no auth.json, no credenziali).
77. Test worker handler con vi.stubGlobal chrome (sendNativeMessage mock).
78. verify-dist: nessun segreto di test nel bundle.

## E. Panel + i18n — 79–90
79. Select provider con <optgroup> per group.
80. Card "opencode" nel tab impostazioni: stato + bottoni Rileva/Importa.
81. Stato: opencode trovato (N credenziali) / bridge mancante (comando setup).
82. Import: applica provider+chiave+modello default per provider scelto.
83. Key-hint i18n con keyUrl per tutti i provider.
84. Stringhe it: opencode section, import, errori bridge.
85. Stringhe en: parità.
86. Test i18n: parità chiavi it/en (regressione auto).
87. Model datalist aggiornato ai 25 provider.
88. Badge "locale"/"gateway" nella select (title attr).
89. e2e: smoke invariato verde con nuovo manifest.
90. usage/stats invariati (regressione).

## F. Q + docs + release — 91–100
91. pnpm typecheck verde.
92. pnpm test: ≥ 199 + nuovi (~40) tutti verdi.
93. Coverage soglie 85/85/80 mantenute.
94. pnpm test:e2e 7/7.
95. GUIDA.md: tabella 25 provider + sezione opencode.
96. PRIVACY.md + SECURITY.md: bridge, nativeMessaging, perimetro chiavi.
97. README/STORE.md: conteggio 25 provider, opencode integration.
98. CHANGELOG.md 0.6.0 + version bump package/manifest + release zip name dinamico.
99. AGENTS.md: struttura native/ + script setup + provider count.
100. Commit + tag v0.6.0 + release zip + GitHub release.
