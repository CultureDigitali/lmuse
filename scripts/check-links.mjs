// Verifica che i link relativi nei .md puntino a file esistenti.
// Uso: node scripts/check-links.mjs (anche in CI).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const mdFiles = readdirSync(root).filter((f) => f.endsWith('.md'));
let failed = false;

for (const file of mdFiles) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)#\s][^)\s]*)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const abs = resolve(join(root, dirname(file), target));
    if (!existsSync(abs)) {
      console.error(`BROKEN: ${file} → ${target}`);
      failed = true;
    }
  }
}
console.log(failed ? 'check-links: link rotti trovati.' : `check-links ok (${mdFiles.length} file).`);
process.exit(failed ? 1 : 0);
