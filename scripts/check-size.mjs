// Budget bundle dist: fallisce se i JS superano le soglie (KB).
// Uso: node scripts/check-size.mjs (richiede pnpm build prima).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const limitsKb = { 'background.js': 1300, 'content.js': 50 };
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
