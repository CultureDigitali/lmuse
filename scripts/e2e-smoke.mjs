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
    await page.bringToFront();
    // Attesa esplicita del contesto: sotto xvfb un tab dell'estensione in
    // secondo piano può non avere un execution context pronto, e le valutazioni
    // successive falliscono con "document is not defined".
    await page.waitForFunction('document.readyState === "complete" && !!chrome?.runtime?.id', {
      timeout: 15_000,
    });
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

    // --- Run REALE end-to-end dell'agente, senza credenziali.
    // Mock OpenAI-compatibile locale: prima risposta chiede browser_snapshot,
    // la seconda è la risposta finale. Copre l'unico percorso che conta
    // (pannello → worker → agente → tool → content script → DONE → storage),
    // mai esercitato prima.
    let llmCalls = 0;
    const mock = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        llmCalls += 1;
        const usage = { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 };
        const payload =
          llmCalls === 1
            ? {
                id: 'm1',
                object: 'chat.completion',
                created: 1,
                model: 'mock-model',
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [
                        {
                          id: 'c1',
                          type: 'function',
                          function: { name: 'browser_snapshot', arguments: '{}' },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
                usage,
              }
            : {
                id: 'm2',
                object: 'chat.completion',
                created: 2,
                model: 'mock-model',
                choices: [
                  {
                    index: 0,
                    message: { role: 'assistant', content: 'RISPOSTA FINALE MOCK' },
                    finish_reason: 'stop',
                  },
                ],
                usage,
              };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise((r) => mock.listen(0, '127.0.0.1', r));
    const mockBase = `http://127.0.0.1:${mock.address().port}/v1`;

    // Pagina dell'estensione che fa da client della Port. Non si usa il
    // pannello: in CI il side panel non è un frame di documento e la
    // serializzazione delle funzioni fallisce con "document is not defined".
    // Stessa sequenza che funziona per il tab del pannello più sopra (goto +
    // attesa + attesa del contesto): sotto xvfb un tab dell'estensione aperto
    // per il pilotaggio non aveva un execution context pronto e ogni
    // valutazione falliva con "document is not defined".
    // Il service worker MV3 si addormenta: su CI può essere dormiente in quel
    // momento e worker() restituirebbe undefined, facendo fallire le valutazioni
    // con un errore fuorviante ("document is not defined"). Si riprova.
    let workerNow = null;
    for (let attempt = 0; attempt < 20 && !workerNow; attempt++) {
      const t = browser.targets().find((x) => x.type() === 'service_worker' && x.url().includes(extId));
      if (t) workerNow = await t.worker();
      if (!workerNow) await new Promise((r) => setTimeout(r, 500));
    }
    check('service worker raggiungibile per il run', workerNow !== null);

    const panel = await browser.newPage();
    await panel.goto(`chrome-extension://${extId}/sidepanel/index.html`);
    await new Promise((r) => setTimeout(r, 2500));
    // Si verifica il contesto PRIMA di usarlo: se manca, si dice perché.
    const panelReady = await panel
      .evaluate('typeof document !== "undefined" && !!chrome && !!chrome.runtime')
      .catch(() => false);
    check('contesto del pannello pronto per il pilotaggio', panelReady === true);

    // Diagnosi: il pilotaggio avviene dal pannello o dal worker? Il worker è
    // l'unico contesto che ha sempre funzionato; la Port dal pannello fallisce
    // in CI. Si prova la connessione su entrambi e si riporta l'esito.
    const portProbePanel = await panel
      .evaluate(
        `(() => { try { const p = chrome.runtime.connect({ name: 'lmuse' }); p.disconnect(); return 'ok'; } catch (e) { return 'ERR ' + String(e && e.message); } })()`,
      )
      .catch((e) => 'EVAL ' + String(e && e.message));
    check('Port: connessione dal pannello', portProbePanel === 'ok', portProbePanel);

    // Il pilotaggio del run avviene dal service worker (non dal pannello): è il
    // contesto dell'estensione che ha chrome.tabs e gestisce RUN/Port.
    // Storage e Port sono pilotati in due contesti distinti, per un motivo
    // preciso: la Port la gestisce il lato UI (pannello), mentre le impostazioni
    // e la lettura delle statistiche le scrive/legge il worker. Una Port aperta
    // dal worker viene subito disconnessa dal suo stesso listener.
    await workerNow.evaluate((baseUrl) => {
      const settings = {
        providerId: 'custom',
        model: 'mock-model',
        baseUrl,
        maxSteps: 6,
        maxRetries: 0,
        runTimeoutMin: 2,
        approvalTimeoutSec: 30,
        snapshotMaxChars: 12000,
        rememberKey: false,
        privacyMaskPii: true,
        privacyHidePasswords: true,
        privacyHostOnly: false,
        keepHistory: false,
        approval: 'off',
        sendScreenshots: false,
        allowedDomains: '',
        trustedDomains: [],
        savedPrompts: [],
        theme: 'auto',
        locale: 'it',
        maxTokensPerRun: 60000,
        stopText: '',
        soundOnDone: false,
        compactLog: false,
        lastRuns: [],
        schedules: [],
        sessionLockMin: 0,
      };
      return chrome.storage.local.set({
        'lmuse.settings.v1': settings,
        'lmuse.onboarded.v1': true,
      });
    }, mockBase);

    // Si passa una STRINGA, non una funzione: il serializzatore di Puppeteer
    // delle funzioni fallisce con "document is not defined" quando la pagina non
    // è un frame di documento (in CI capita). La forma a stringa è già usata più
    // sotto per axe e funziona in ogni contesto.
    // Si imposta il listener in-page (stringa: forma già usata per axe e
    // verificata anche in CI), poi si ATTENDE il risultato con waitForFunction,
    // che è il meccanismo supportato per l'asincrono: page.evaluate con una
    // stringa non attende un Promise e falliva in CI.
    const setupOutcome = await panel.evaluate(`(() => { try {
      window.__lmuseRun = { steps: [], done: null, error: null };
      const port = chrome.runtime.connect({ name: 'lmuse' });
      port.onMessage.addListener((m) => {
        if (m && m.type === 'STEP') window.__lmuseRun.steps.push(m);
        if (m && m.type === 'DONE') window.__lmuseRun.done = m;
        if (m && m.type === 'ERROR') window.__lmuseRun.error = m;
      });
      port.postMessage({ type: 'RUN', task: 'Leggi la pagina di prova' });
      return 'ok';
    } catch (e) { return 'ERR ' + String(e && e.message) + ' @ ' + String(e && e.stack).slice(0,120); } })()`);
    check('run completo: pilotaggio avviato', setupOutcome === 'ok', setupOutcome);
    // Il worker MV3 si addormenta: in CI, dopo l'attesa del worker, il RUN
    // inviato dal pannello non lo sveglia e resta lettera morta (diagnostica:
    // listener installato, zero step). Lo si tiene sveglio con un heartbeat
    // durante l'attesa del run.
    const keepAlive = setInterval(() => {
      void workerNow.evaluate('void 0').catch(() => undefined);
    }, 2000);
    // Causa del fallimento in CI: se window.__lmuseRun è undefined, `r.done`
    // genera in-page un errore che Puppeteer riporta come "document is not
    // defined" (il nome della variabile della closure). Da qui la necessità di
    // controllare l'esistenza prima di leggerne i campi.
    let runOutcome = { steps: [], done: null, error: null };
    try {
      // Ciclo di attesa esplicito: con polling 'raf' l'handle restituito da
      // waitForFunction può riferirsi a una valutazione precedente (null), quindi
      // il risultato va riletto dalla pagina finché non è pronto.
      const deadline = Date.now() + 25_000;
      while (Date.now() < deadline) {
        let raw;
      try {
        raw = await panel.evaluate(`(function () {
          var r = window.__lmuseRun;
          if (!r) return null;
          if (r.done || r.error) return JSON.stringify(r);
          return null;
        })()`);
      } catch (e) {
        console.log('DEBUG raw errore:', String(e && e.message));
        console.log('DEBUG stack:', String(e && e.stack).split('\n').slice(0, 4).join(' | '));
        throw e;
      }
        if (typeof raw === 'string' && raw) {
          runOutcome = JSON.parse(raw);
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      const dump = await panel
        .evaluate(
          `(() => JSON.stringify({ definito: typeof window.__lmuseRun !== 'undefined', campi: typeof window.__lmuseRun !== 'undefined' ? { step: window.__lmuseRun.steps.length, done: !!window.__lmuseRun.done, error: window.__lmuseRun.error ? window.__lmuseRun.error.message : null } : null }))()`,
        )
        .catch((x) => 'dump fallito: ' + String(x && x.message));
      check('run completo: diagnostica', false, String(e && e.message).slice(0, 90) + ' | stato: ' + dump);
      runOutcome = { steps: [], done: null, error: { message: 'timeout in attesa del run' } };
    } finally {
      clearInterval(keepAlive);
    }
    check('run completo: nessun errore', !runOutcome.error, runOutcome.error?.message ?? '');
    check(
      'run completo: DONE ricevuto con risposta del modello',
      runOutcome.done?.text === 'RISPOSTA FINALE MOCK',
      JSON.stringify(runOutcome.done ?? null).slice(0, 160),
    );
    check(
      "run completo: l'agente ha usato browser_snapshot",
      runOutcome.steps.some((s) => String(s.tool).includes('browser_snapshot')),
    );
    // summarizeOutput riduce volutamente l'osservazione a "snapshot
    // aggiornato" (non si riversa l'albero della pagina nel log). La prova che
    // il modello abbia VISTO la pagina è il confronto con il rendering del
    // provider: la seconda risposta mock arriva solo se il primo turno è
    // avvenuto, e il passo è marcato come riuscito.
    const snapStep = runOutcome.steps.find((s) => String(s.tool).includes('browser_snapshot'));
    check(
      'run completo: passo snapshot riuscito (nessun errore)',
      Boolean(snapStep) && !/✕|error/i.test(String(snapStep.tool)),
      snapStep?.tool ?? 'nessun passo',
    );
    check(
      'run completo: il modello ha ricevuto il risultato del tool',
      runOutcome.done?.inputTokens > 0,
      `inputTokens=${runOutcome.done?.inputTokens ?? 0}`,
    );
    const usageStored = await workerNow.evaluate(() => chrome.storage.local.get('lmuse.usage.v1'));
    check("run completo: statistiche d'uso salvate", (usageStored['lmuse.usage.v1']?.runs ?? 0) >= 1);

    await panel.close();
    mock.close();
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
