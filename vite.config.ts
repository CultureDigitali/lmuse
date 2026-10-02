import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Il bundle background include gli SDK dei provider: il warning di default
    // (500 kB) è fuorviante per un'estensione, alziamo la soglia a 1.2 MB.
    chunkSizeWarningLimit: 1200,
    // I provider sono caricati con import() dinamici, e per essi Vite inietta
    // l'helper modulepreload, che tocca `document`: in un service worker MV3
    // `document` non esiste e il run falliva con "document is not defined".
    // Il preload dei chunk è solo un'ottimizzazione, e nel service worker MV3
    // è dannoso: l'helper __vitePreload tocca `document`, che in un worker non
    // esiste, e ogni import dinamico (i 25 provider) faceva fallire il task con
    // "document is not defined". Si disattiva il polyfill e si svuota la lista
    // delle dipendenze da precaricare, così il wrapper non esegue codice DOM.
    modulePreload: { polyfill: false, resolveDependencies: () => [] },
    rollupOptions: {
      input: {
        background: resolve(root, 'src/background/index.ts'),
        content: resolve(root, 'src/content/index.ts'),
        'sidepanel/index': resolve(root, 'sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
