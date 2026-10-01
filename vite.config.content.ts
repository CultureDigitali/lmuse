import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Build separata per il content script.
//
// `chrome.scripting.executeScript({ files })` inietta script CLASSICI, non
// moduli ES: un `import` residuo nel bundle fa fallire l'iniezione in silenzio
// (il listener non si registra e 24 tool su 26 risultano morti). Per questo il
// content script va emesso in formato IIFE, autocontenuto, in una build propria:
// Rollup non ammette formati diversi per voci diverse della stessa build.
//
// Non deve svuotare dist/: la build principale scrive prima e questa ci aggiunge
// il solo content.js.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/content/index.ts'),
      name: 'LmuseContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
