// Smoke test e2e: carica dist/ non pacchettizzata in Chrome reale e verifica
// installazione, service worker vivo, sidepanel senza errori.
// Uso: pnpm test:e2e (richiede pnpm build prima; CHROME_PATH opzionale).
// Su CI linux girare sotto xvfb-run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// Chromium snapshot pinnato: Google Chrome branded blocca --load-extension,
// Chromium no. Se manca: `node -e "import('@puppeteer/browsers')..."` (vedi CI).
export const CHROMIUM_BUILD = '1698520';

function cachedChromium() {
  const base = join(homedir(), '.cache', 'puppeteer', 'chromium');
  try {
    for (const dir of readdirSync(base)) {
      for (const exe of [
        join(base, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        join(base, dir, 'chrome-linux', 'chrome'),
      ]) {
        if (existsSync(exe)) return exe;
      }
    }
  } catch {
    /* cache assente */
  }
  return '';
}

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return (
    cachedChromium() ||
    (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '(branded: --load-extension bloccato, usa Chromium in cache)'
      : '')
  );
}

const executablePath = findChrome();
if (!executablePath || executablePath.startsWith('(branded')) {
  console.error(
    'e2e: serve Chromium (Google Chrome branded blocca --load-extension). ' +
      `Scarica: node -e "import('@puppeteer/browsers').then(async (m) => { const {homedir} = await import('node:os'); const {join} = await import('node:path'); await m.install({browser: m.Browser.CHROMIUM, buildId: '${CHROMIUM_BUILD}', cacheDir: join(homedir(), '.cache', 'puppeteer')}); })"`,
  );
  process.exit(2);
}
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('e2e: dist/ mancante (esegui pnpm build).');
  process.exit(1);
}

const errors = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok' : 'FAIL'} e2e: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) errors.push(name);
};

const browser = await puppeteer.launch({
  executablePath,
  headless: false,
  // Senza questo, puppeteer disabilita tutte le estensioni di default.
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=${join(root, '.e2e-profile')}`,
  ],
});

try {
  await new Promise((r) => setTimeout(r, 4000));
  const targets = browser.targets();
  const sw = targets.find((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'));
  check('service worker registrato', !!sw, sw?.url() ?? 'assente');
  const extId = sw ? new URL(sw.url()).hostname : '';
  check('extension id valido', /^[a-z]{32}$/.test(extId), extId);

  if (extId) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
    });
    // Prima naviga nel contesto estensione: fetch cross-scheme da about:blank è vietato.
    await page.goto(`chrome-extension://${extId}/sidepanel/index.html`);
    await new Promise((r) => setTimeout(r, 2500));
    const manifest = await page.evaluate(async () => {
      const res = await fetch('chrome-extension://' + location.hostname + '/manifest.json');
      return res.json();
    });
    check('manifest leggibile e versione coerente', manifest?.version === pkg.version, manifest?.version);
    const hasRoot = await page.evaluate(() => !!document.getElementById('root')?.childElementCount);
    check('sidepanel renderizzato', hasRoot);
    check('zero errori pagina', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error(`e2e: ${errors.length} controlli falliti.`);
  process.exit(1);
}
console.log('e2e: tutti i controlli passati.');
