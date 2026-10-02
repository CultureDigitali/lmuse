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

// Nei service worker di estensione MV3 `import()` NON è supportato (Chrome lo
// vieta: w3c/ServiceWorker#1356). Se nel bundle del worker ricompare un import
// dinamico, ogni task muore con "import() is disallowed on
// ServiceWorkerGlobalScope": il modello non viene mai creato. Gli import dei
// provider devono quindi restare statici e il worker deve essere un file solo.
const backgroundJs = join(root, 'dist', 'background.js');
try {
  const src = readFileSync(backgroundJs, 'utf8');
  if (/(?<![A-Za-z0-9_$.])import\s*\(/.test(src)) {
    fail(
      'dist/background.js contiene import() dinamico: non è supportato nei service ' +
        'worker MV3 e ogni task fallisce. Usare import statici in src/background/.',
    );
  }
  // Gli import statici da chunk sono leciti (il module worker li carica all
  // avvio). Ciò che è vietato è il caricamento a runtime: nessun import()
  // dinamico può citare un chunk, perché il worker non lo può raggiungere.
  const dynamicImports = [...src.matchAll(/import\s*\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  if (dynamicImports.length > 0) {
    fail(
      `dist/background.js contiene ${dynamicImports.length} import() dinamici ` +
        `(${dynamicImports.slice(0, 3).join(', ')}): non sono supportati nei service ` +
        'worker MV3. Usare import statici in src/background/.',
    );
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
console.log(`verify-dist ok: lmuse ${manifest.version}, MV3, entry presenti.`);
