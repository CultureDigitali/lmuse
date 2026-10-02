// Budget bundle dist: fallisce se i JS superano le soglie (KB).
// Uso: node scripts/check-size.mjs (richiede pnpm build prima).
//
// Nota su background.js: la soglia è 1200 KB e non 500 perché nei service
// worker MV3 `import()` non è supportato, quindi i 25 SDK provider non possono
// essere caricati su richiesta e devono stare nel bundle. Il costo reale
// (253 KB gzip) resta contenuto e Chrome non ha un limite vicino a questo.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const limitsKb = { 'background.js': 1200, 'content.js': 50 };
let failed = false;

function readdirDist(dir) {
  try {
    return readdirSync(join(root, 'dist', dir));
  } catch {
    return [];
  }
}

for (const chunk of readdirDist('sidepanel')) {
  if (chunk.endsWith('.js')) limitsKb[`sidepanel/${chunk}`] = 400;
}

for (const [file, maxKb] of Object.entries(limitsKb)) {
  let kb;
  try {
    kb = statSync(join(root, 'dist', file)).size / 1024;
  } catch {
    kb = null;
  }
  if (kb == null) {
    console.error(`MANCA: dist/${file} (esegui pnpm build)`);
    failed = true;
    continue;
  }
  const ok = kb <= maxKb ? 'ok' : 'SUPERATO';
  console.log(`${ok} dist/${file}: ${kb.toFixed(1)} KB (max ${maxKb})`);
  if (kb > maxKb) failed = true;
}
process.exit(failed ? 1 : 0);
