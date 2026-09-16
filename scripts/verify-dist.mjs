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
console.log(`verify-dist ok: lmuse ${manifest.version}, MV3, entry presenti.`);
