// Verifica che dist/ sia un'estensione caricabile: manifest coerente col
// package.json + entry presenti. Uso: node scripts/verify-dist.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const fail = (msg) => {
  console.error(`verify-dist: ${msg}`);
  process.exit(1);
};

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifestPath = join(root, 'dist', 'manifest.json');
if (!existsSync(manifestPath)) fail('dist/manifest.json mancante (esegui pnpm build)');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version deve essere 3');
if (manifest.version !== pkg.version)
  fail(`versione manifest (${manifest.version}) != package (${pkg.version})`);
if (!manifest.content_security_policy?.extension_pages?.includes("script-src 'self'")) {
  fail('CSP extension_pages mancante');
}
for (const file of ['background.js', 'content.js', 'sidepanel/index.html']) {
  if (!existsSync(join(root, 'dist', file))) fail(`dist/${file} mancante`);
}
if (manifest.content_scripts) fail('content_scripts statico non ammesso (iniezione on-demand)');

// Il content script viene iniettato con chrome.scripting.executeScript({files}),
// che accetta SOLO script classici. Un modulo ES residuo (import/export di primo
// livello) fa fallire l'iniezione in silenzio: il listener non si registra e
// 24 tool su 26 restano morti senza che nulla fallisca. Controllo statico:
// intercetta il packaging rotto anche senza browser.
const contentJs = join(root, 'dist', 'content.js');
try {
  const src = readFileSync(contentJs, 'utf8');
  if (/^\s*(import|export)\s/m.test(src)) {
    fail('dist/content.js è un modulo ES: deve essere IIFE (build separata vite.config.content.ts)');
  }
  if (/\bimport\s*\(/.test(src)) fail('dist/content.js contiene import dinamico: non valido in IIFE');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

// L'helper __vitePreload di Vite avvolge ogni import() dinamico (i 25 provider)
// e, se gli viene passata una lista di dipendenze, esegue
// `document.getElementsByTagName('link')`: in un service worker MV3 `document`
// non esiste e il task muore con "document is not defined". Il codice dell'helper
// resta nel bundle anche quando è innocuo, quindi si verifica il comportamento
// reale: nessuna chiamata all'helper può ricevere una lista di dipendenze.
try {
  const src = readFileSync(join(root, 'dist', 'background.js'), 'utf8');
  const preloadCalls = [...src.matchAll(/(?<![A-Za-z0-9_$])__vitePreload\(|Z\(async\(\)=>\{/g)];
  if (preloadCalls.length > 0) {
    const withDeps = [...src.matchAll(/__vite__mapDeps\(\[(?!\])([^\]]*)\]/g)];
    if (withDeps.length > 0) {
      fail(
        'dist/background.js precarica chunk nei dynamic import: nel service worker ' +
          "l'helper usa `document` e il task fallisce. Configura " +
          'build.modulePreload con polyfill:false e resolveDependencies:()=>[].',
      );
    }
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
console.log(`verify-dist ok: lmuse ${manifest.version}, MV3, entry presenti.`);
