// Smoke test e2e: carica dist/ non pacchettizzata in Chrome reale e verifica
// installazione, service worker vivo, sidepanel senza errori.
// Uso: pnpm test:e2e (richiede pnpm build prima; CHROME_PATH opzionale).
// Su CI linux girare sotto xvfb-run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// Browser pinnato per e2e. Google Chrome branded blocca --load-extension;
// "Chrome for Testing" è la build non marchiata usata per l'automazione e lo
// consente. Va preso dal bucket chrome-for-testing, che pubblica sia Linux
// sia macOS (il vecchio bucket chromium-browser-snapshots non ha più build
// per Linux: era la causa del fallimento della CI).
export const BROWSER_VERSION = '155.0.8059.12';
export const CHROMIUM_PIN_DATE = '2026-09-28';

function cachedBrowser() {
  const base = join(homedir(), '.cache', 'puppeteer');
  for (const flavour of ['chrome', 'chromium']) {
    try {
      for (const dir of readdirSync(join(base, flavour))) {
        for (const exe of [
          join(base, flavour, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
          join(
            base,
            flavour,
            dir,
            'chrome-mac-arm64',
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
          ),
          join(
            base,
            flavour,
            dir,
            'chrome-mac-x64',
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
          ),
          join(base, flavour, dir, 'chrome-linux64', 'chrome'),
          join(base, flavour, dir, 'chrome-linux', 'chrome'),
        ]) {
          if (existsSync(exe)) return exe;
        }
      }
    } catch {
      /* cache assente */
    }
  }
  return '';
}

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return (
    cachedBrowser() ||
    (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '(branded: --load-extension bloccato, usa Chrome for Testing in cache)'
      : '')
  );
}

const executablePath = findChrome();
if (!executablePath || executablePath.startsWith('(branded')) {
  console.error(
    'e2e: serve Chrome for Testing (Google Chrome branded blocca --load-extension). ' +
      `Scarica: node -e "import('@puppeteer/browsers').then(async (m) => { const {homedir} = await import('node:os'); const {join} = await import('node:path'); await m.install({browser: m.Browser.CHROME, buildId: '${BROWSER_VERSION}', cacheDir: join(homedir(), '.cache', 'puppeteer')}); })"`,
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
    const hasSettings = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) =>
        ['Impostazioni', 'Settings'].includes(b.getAttribute('aria-label') ?? ''),
      ),
    );
    check('panel interattivo (bottone impostazioni)', hasSettings);
    check('zero errori pagina', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    // A11y: axe-core via CDP evaluate (esente da CSP extension_pages), zero serious/critical.
    const axeSource = readFileSync(join(root, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
    const violationsJson = await page.evaluate(
      `${axeSource}; axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id + '(' + v.nodes.length + ')')));`,
    );
    const violations = JSON.parse(violationsJson);
    check('a11y: zero serious/critical', violations.length === 0, violations.slice(0, 5).join(' | '));
    await page.close();

    // --- Prova REALE del prodotto: il content script iniettato su una pagina
    // vera deve registrarsi e rispondere a uno snapshot. È il percorso che
    // usano 24 tool su 26: senza questo controllo un bundle non iniettabile
    // passerebbe la CI verde (bug del 2026-09-30).
    const pageHtml =
      '<!doctype html><html lang="it"><head><title>Pagina di prova</title></head>' +
      '<body><h1>Verifica</h1><a href="/prova">Link di prova</a>' +
      '<button id="b">Premi</button></body></html>';
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const testUrl = `http://127.0.0.1:${server.address().port}/prova.html`;
    const target = await browser.newPage();
    await target.goto(testUrl, { waitUntil: 'domcontentloaded' });
    const swTarget = browser.targets().find((t) => t.type() === 'service_worker' && t.url().includes(extId));
    const worker = await swTarget?.worker();
    const snapResult = await worker.evaluate(async (tabUrl) => {
      const [tab] = await chrome.tabs.query({ url: tabUrl });
      if (!tab?.id) return { ok: false, error: 'tab non trovato' };
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await chrome.tabs.sendMessage(tab.id, { kind: 'LMUSE_SNAPSHOT', maskPii: true });
        return { ok: Boolean(res?.ok && res.tree), tree: String(res?.tree ?? '').slice(0, 200) };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e).slice(0, 120) };
      }
    }, testUrl);
    check(
      'content script iniettato e snapshot funzionante',
      snapResult.ok === true,
      snapResult.ok ? '' : `errore: ${snapResult.error}`,
    );
    check(
      'snapshot contiene gli elementi della pagina',
      snapResult.ok === true && /Link di prova|Premi/.test(snapResult.tree ?? ''),
    );
    await target.close();
    server.close();
  }
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error(`e2e: ${errors.length} controlli falliti.`);
  process.exit(1);
}
console.log('e2e: tutti i controlli passati.');
