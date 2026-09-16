// Il pin Chromium per e2e invecchia: fallisce se più vecchio di 120 giorni.
// Uso: node scripts/check-chromium-age.mjs (anche in CI, richiede rete).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const MAX_AGE_DAYS = 120;

const smoke = readFileSync(join(root, 'scripts', 'e2e-smoke.mjs'), 'utf8');
const pin = smoke.match(/CHROMIUM_PIN_DATE = '(\d{4}-\d{2}-\d{2})'/)?.[1];
if (!pin) {
  console.error('check-chromium-age: CHROMIUM_PIN_DATE assente in e2e-smoke.mjs');
  process.exit(1);
}
const res = await fetch(
  'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json',
);
if (!res.ok) {
  console.error(`check-chromium-age: rete non disponibile (HTTP ${res.status}), skip.`);
  process.exit(0);
}
const data = await res.json();
const ref = new Date(data.timestamp ?? Date.now());
const ageDays = Math.floor((Date.now() - new Date(`${pin}T00:00:00Z`).getTime()) / 86_400_000);
console.log(
  `check-chromium-age: pin ${pin}, stable ref ${ref.toISOString().slice(0, 10)}, età ${ageDays}gg.`,
);
if (ageDays > MAX_AGE_DAYS) {
  console.error(`check-chromium-age: pin più vecchio di ${MAX_AGE_DAYS}gg, aggiornare CHROMIUM_BUILD.`);
  process.exit(1);
}
