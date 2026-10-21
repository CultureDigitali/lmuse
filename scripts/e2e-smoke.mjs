// Smoke test e2e: carica dist/ non pacchettizzata in Chrome reale e verifica
// installazione, service worker vivo, sidepanel senza errori.
// Uso: pnpm test:e2e (richiede pnpm build prima; CHROME_PATH opzionale).
// Su CI linux girare sotto xvfb-run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
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

/** Clic reale sul bottone del pannello, senza invocare il relativo handler in JS. */
async function clickPanelButton(page, labels) {
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const label = await button.evaluate((element) => element.textContent ?? '');
    if (labels.some((text) => label.includes(text))) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function hostRolePresent(page, origin, purpose) {
  return page.evaluate(
    async ({ origin, purpose }) => {
      const stored = await chrome.storage.local.get('lmuse.hostGrants.v1');
      return (stored['lmuse.hostGrants.v1'] ?? []).some(
        (entry) => entry.origin === origin && entry.purpose === purpose,
      );
    },
    { origin, purpose },
  );
}

async function waitForHostRole(page, origin, purpose, expected) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if ((await hostRolePresent(page, origin, purpose)) === expected) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

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
    check(
      'installazione senza permessi host globali obbligatori',
      !(manifest.host_permissions ?? []).includes('<all_urls>') &&
        (manifest.host_permissions ?? []).length === 0 &&
        (manifest.optional_host_permissions ?? []).includes('https://*/*') &&
        (manifest.optional_host_permissions ?? []).includes('http://*/*'),
    );
    check(
      'LM-004: niente permesso tabs su tutte le schede',
      !(manifest.permissions ?? []).includes('tabs') &&
        (manifest.permissions ?? []).includes('scripting') &&
        (manifest.permissions ?? []).includes('activeTab'),
    );
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
      '<body><h1>Verifica</h1><a href="/prova">Link di prova mario.rossi@example.it</a>' +
      '<button id="b">Premi</button></body></html>';
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const testUrl = `http://127.0.0.1:${server.address().port}/prova.html`;
    const target = await browser.newPage();
    await target.goto(testUrl, { waitUntil: 'domcontentloaded' });
    // Exercita il percorso reale: un utente immette l'URL e concede il
    // permesso dal pannello. L'allowlist testuale NON autorizza Chrome.
    const permissionPanel = await browser.newPage();
    await permissionPanel.goto(`chrome-extension://${extId}/sidepanel/index.html`);
    await permissionPanel.bringToFront();
    await permissionPanel.waitForFunction('document.readyState === "complete" && !!chrome?.runtime?.id', {
      timeout: 15_000,
    });
    await new Promise((r) => setTimeout(r, 1000));
    await permissionPanel.waitForSelector('button[aria-label="Impostazioni"],button[aria-label="Settings"]', {
      timeout: 15_000,
    });
    // Al primo avvio, l'assenza della chiave apre già le impostazioni:
    // cliccare sempre il toggle le chiude e rende impossibile il grant.
    const sitePermissionSelector = 'input[aria-label="URL sito per permesso Chrome"]';
    if (!(await permissionPanel.$(sitePermissionSelector))) {
      await permissionPanel.click('button[aria-label="Impostazioni"],button[aria-label="Settings"]');
    }
    await permissionPanel.waitForSelector(sitePermissionSelector, { timeout: 15_000 });
    await permissionPanel.type('input[aria-label="URL sito per permesso Chrome"]', testUrl);
    const swTarget = browser.targets().find((t) => t.type() === 'service_worker' && t.url().includes(extId));
    const worker = await swTarget?.worker();
    const unreadableBeforeGrant = await worker.evaluate(async (tabUrl) => {
      const tabsPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
      const tabs = await chrome.tabs.query({});
      // Le API di base tabs.* sono accessibili, ma senza tab metadata globale
      // URL e titolo della pagina non autorizzata devono restare invisibili.
      return !tabsPermission && !tabs.some((tab) => tab.url === tabUrl || tab.title === 'Pagina di prova');
    }, testUrl);
    check('LM-004: URL e titolo tab non autorizzato invisibili prima del grant', unreadableBeforeGrant);
    const checkHostPermission = async (url) =>
      worker.evaluate(async (sourceUrl) => {
        const origin = new URL(sourceUrl);
        return chrome.permissions.contains({ origins: [origin.protocol + '//' + origin.hostname + '/*'] });
      }, url);
    check('site permission absent before user grant', !(await checkHostPermission(testUrl)));
    const grantButton = await permissionPanel.$$('button');
    let grantClicked = false;
    for (const button of grantButton) {
      const title = await button.evaluate((node) => node.textContent ?? '');
      if (
        title.includes('Autorizza questo sito in Chrome') ||
        title.includes('Allow this website in Chrome')
      ) {
        await button.click();
        grantClicked = true;
        break;
      }
    }
    check('pulsante grant sito disponibile', grantClicked);
    // Chromium presenta la conferma in UI browser (fuori dal DOM del panel).
    // Il runner Xvfb invia UNA conferma reale via X11, mai via API/fixture bypass.
    if (process.env.LMUSE_E2E_NATIVE_GRANT === '1') {
      try {
        await new Promise((r) => setTimeout(r, 600));
        console.log(
          'e2e Chrome native active window:',
          execFileSync('xdotool', ['getactivewindow', 'getwindowname'], { encoding: 'utf8' }).trim(),
        );
        execFileSync('xdotool', ['key', '--clearmodifiers', 'Tab']);
        await new Promise((r) => setTimeout(r, 250));
        execFileSync('xdotool', ['key', '--clearmodifiers', 'Return']);
      } catch (error) {
        check('native UI confirmation via X11', false, String(error));
      }
    }
    let grantedOrigin = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      grantedOrigin = await checkHostPermission(testUrl);
      if (grantedOrigin) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const permissionStatus = await permissionPanel
      .evaluate(() =>
        [...document.querySelectorAll('[role="status"]')].map((node) => node.textContent?.trim()),
      )
      .catch(() => ['(no UI status)']);
    check('permesso host esplicito concesso dopo gesto UI', grantedOrigin, permissionStatus);
    check('other hostname is NOT granted', !(await checkHostPermission('http://localhost:9999/prova')));
    check(
      'site grant saved with exact port and role',
      await waitForHostRole(permissionPanel, new URL(testUrl).origin, 'site', true),
    );
    const tabMetadataAfterGrant = await worker.evaluate(async (tabUrl) => {
      const tabs = await chrome.tabs.query({ url: tabUrl });
      return tabs.some((tab) => tab.url === tabUrl && tab.title === 'Pagina di prova');
    }, testUrl);
    check('LM-004: URL e titolo tab disponibili dopo il grant host', tabMetadataAfterGrant);
    if (!grantedOrigin)
      throw new Error('Permesso host non concesso dalla finestra Chrome: ' + permissionStatus);
    const authorizedTabId = await worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return tab?.id ?? -1;
    }, testUrl);
    check('LM-005: id tab autorizzato registrato prima della revoca', authorizedTabId > 0);
    await permissionPanel.close();
    await target.bringToFront();
    const snapResult = await worker.evaluate(async (tabUrl) => {
      const [tab] = await chrome.tabs.query({ url: tabUrl });
      if (!tab?.id) return { ok: false, error: 'tab non trovato' };
      // In CI, permission grants must come from an explicit extension UI gesture.
      // No implicit grant from the service worker.
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
    let leakedSensitive = false;
    let sawPseudonym = false;
    let holdModelResponses = false;
    let heldModelRequest = false;
    const heldResponses = new Set();
    const mock = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (holdModelResponses) {
          heldModelRequest = true;
          heldResponses.add(res);
          res.once('close', () => heldResponses.delete(res));
          // Non inviare risposta: per LM-005 il run deve essere ancora vivo
          // quando il tester revoca il sito tramite la vera UI di Chrome.
          return;
        }
        leakedSensitive ||= body.includes('mario.rossi@example.it');
        sawPseudonym ||= body.includes('[LMUSE_EMAIL_');
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
        // Il worker usa ToolLoopAgent.stream(), quindi l'AI SDK consuma la
        // risposta come SSE. Un body JSON non-streaming verrebbe letto come un
        // chunk di testo vuoto: nessun tool eseguito e testo finale vuoto. Il
        // mock replica quindi il formato reale di un provider OpenAI.
        const msg = payload.choices[0].message;
        const base = {
          id: payload.id,
          object: 'chat.completion.chunk',
          created: payload.created,
          model: payload.model,
          choices: [{ index: 0, delta: {}, finish_reason: null }],
        };
        const frames = [
          { ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
        ];
        if (msg.tool_calls) {
          frames.push({
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: msg.tool_calls[0].id,
                      type: 'function',
                      function: {
                        name: msg.tool_calls[0].function.name,
                        arguments: msg.tool_calls[0].function.arguments,
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
        } else if (msg.content) {
          frames.push({
            ...base,
            choices: [{ index: 0, delta: { content: msg.content }, finish_reason: null }],
          });
        }
        frames.push({
          ...base,
          choices: [{ index: 0, delta: {}, finish_reason: payload.choices[0].finish_reason }],
        });
        // usage_streamed va nell'ultimo chunk, non in uno separato con choices vuoto
        if (payload.usage) {
          const last = frames[frames.length - 1];
          last.usage = payload.usage;
        }

        let wantsStream = false;
        try {
          wantsStream = JSON.parse(body).stream === true;
        } catch {
          // corpo non JSON: si risponde in formato semplice
        }
        if (!wantsStream) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        for (const frame of frames) res.write(`data: ${JSON.stringify(frame)}\n\n`);
        res.end();
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
        privacyMode: 'strict',
        privacyHidePasswords: true,
        privacyHostOnly: false,
        keepHistory: false,
        approval: 'off',
        sendScreenshots: false,
        allowedDomains: '127.0.0.1',
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

    // Lo stesso hostname con una porta diversa e il ruolo provider NON
    // eredita automaticamente il grant sito. L'utente deve autorizzarlo
    // esplicitamente anche se Chrome considera già autorizzato il pattern.
    const providerOrigin = new URL(mockBase).origin;
    const preProvider = !(await hostRolePresent(panel, providerOrigin, 'provider'));
    check('provider on another port is not automatically authorized', preProvider);
    await panel.reload({ waitUntil: 'domcontentloaded' });
    await panel.bringToFront();
    await panel.waitForFunction('document.readyState === "complete" && !!chrome?.runtime?.id', {
      timeout: 15_000,
    });
    await new Promise((r) => setTimeout(r, 1100));
    if (!(await panel.$(sitePermissionSelector))) {
      await panel.click('button[aria-label="Impostazioni"],button[aria-label="Settings"]');
    }
    await panel.waitForSelector(sitePermissionSelector, { timeout: 15_000 });
    const providerGrantClicked = await clickPanelButton(panel, [
      'Autorizza API del provider',
      'Allow AI provider API',
    ]);
    check('provider role request comes from a real panel click', providerGrantClicked);
    const savedProvider = await waitForHostRole(panel, providerOrigin, 'provider', true);
    check('provider permission persisted with exact port and purpose', savedProvider);
    if (!savedProvider) throw new Error('Il pannello non ha registrato la concessione API provider.');

    // Si passa una STRINGA, non una funzione: il serializzatore di Puppeteer
    // delle funzioni fallisce con "document is not defined" quando la pagina non
    // è un frame di documento (in CI capita). La forma a stringa è già usata più
    // sotto per axe e funziona in ogni contesto.
    // Si imposta il listener in-page (stringa: forma già usata per axe e
    // verificata anche in CI), poi si ATTENDE il risultato con waitForFunction,
    // che è il meccanismo supportato per l'asincrono: page.evaluate con una
    // stringa non attende un Promise e falliva in CI.
    // Setup e attesa sono entrambi dentro la protezione: sotto xvfb anche la
    // prima evaluate può lanciare (contesto non pronto), e va trattata come
    // skip motivato e non come fallimento del prodotto.
    // Il pilotaggio del run è incapsulato: sotto xvfb sia il setup sia l'attesa
    // possono lanciare per il contesto non pronto, e va trattato come skip
    // motivato (limite dell'ambiente), non come fallimento del prodotto.
    const runResult = await (async () => {
      try {
        // I tool agiscono sul tab attivo della finestra con focus: sotto xvfb
        // la finestra del pannello può restare in primo piano e il worker
        // troverebbe il tab sbagliato, senza eseguire alcun tool. Si attivano
        // sia il tab sia la finestra del target.
        await target.bringToFront();
        await workerNow.evaluate(
          `(function () {
          return chrome.tabs.query({}).then(function (tabs) {
            var t = tabs.filter(function (x) { return (x.url || '').indexOf(TABURL) === 0; })[0];
            if (!t) return Promise.resolve(null);
            return chrome.tabs.update(t.id, { active: true }).then(function () {
              return t.windowId != null ? chrome.windows.update(t.windowId, { focused: true }) : null;
            });
          });
        })()`.replace('TABURL', JSON.stringify(testUrl)),
        );
        await new Promise((r) => setTimeout(r, 900));

        const setup = await panel.evaluate(`(function () {
          try {
            window.__lmuseRun = { steps: [], done: null, error: null };
            var port = chrome.runtime.connect({ name: 'lmuse' });
            port.onMessage.addListener(function (m) {
              if (!m) return;
              if (m.type === 'STEP') window.__lmuseRun.steps.push(m);
              if (m.type === 'DONE') window.__lmuseRun.done = m;
              if (m.type === 'ERROR') window.__lmuseRun.error = m;
              // Solo nel test su loopback: simuliamo il consenso esplicito del tester.
              if (m.type === 'APPROVAL' && m.tool === 'browser_data_disclosure' &&
                  String(m.description || '').indexOf('127.0.0.1') !== -1) {
                port.postMessage({ type: 'APPROVE', id: m.id });
              }
            });
            port.postMessage({ type: 'RUN', task: 'Leggi la pagina di prova' });
            return 'ok';
          } catch (e) {
            return 'ERR ' + String(e && e.message);
          }
        })()`);
        if (setup !== 'ok') return { skipped: true, motivo: setup };

        const keepAlive = setInterval(() => {
          void workerNow.evaluate('void 0').catch(() => undefined);
        }, 2000);
        try {
          const deadline = Date.now() + 25_000;
          while (Date.now() < deadline) {
            const raw = await panel.evaluate(`(function () {
              var r = window.__lmuseRun;
              if (!r) return null;
              if (r.done || r.error) return JSON.stringify(r);
              return null;
            })()`);
            if (typeof raw === 'string' && raw) return { skipped: false, ...JSON.parse(raw) };
            await new Promise((r) => setTimeout(r, 300));
          }
          const dump = await panel
            .evaluate(
              `(() => JSON.stringify({ step: window.__lmuseRun ? window.__lmuseRun.steps.length : -1 }))()`,
            )
            .catch(() => '{}');
          return { skipped: true, motivo: 'timeout: ' + dump };
        } finally {
          clearInterval(keepAlive);
        }
      } catch (e) {
        return { skipped: true, motivo: String(e && e.message).slice(0, 70) };
      }
    })();

    if (runResult.skipped) {
      check('run completo obbligatorio', false, String(runResult.motivo));
    } else {
      check('run completo: nessun errore', !runResult.error, runResult.error?.message ?? '');
      check(
        'run completo: DONE ricevuto con risposta del modello',
        runResult.done?.text === 'RISPOSTA FINALE MOCK',
        JSON.stringify(runResult.done ?? null).slice(0, 160),
      );
      check(
        "run completo: l'agente ha usato browser_snapshot",
        (runResult.steps ?? []).some((s) => String(s.tool).includes('browser_snapshot')),
      );
      const snapStep = (runResult.steps ?? []).find((s) => String(s.tool).includes('browser_snapshot'));
      check(
        'run completo: passo snapshot riuscito (nessun errore)',
        Boolean(snapStep) && !/\u2715|error/i.test(String(snapStep.tool)),
        snapStep?.tool ?? 'nessun passo',
      );
      check(
        'run completo: il modello ha ricevuto il risultato del tool',
        (runResult.done?.inputTokens ?? 0) > 0,
        `inputTokens=${runResult.done?.inputTokens ?? 0}`,
      );
      check('il provider non riceve email in chiaro', !leakedSensitive);
      check('il provider riceve il segnaposto email', sawPseudonym);
    }

    if (!runResult.skipped) {
      // Si legge dal contesto della PAGINA, non dal worker: in CI il service
      // worker può essere un'istanza diversa da quella che ha salvato (restart
      // MV3), mentre chrome.storage.local è condiviso per estensione. Si attende
      // anche la propagazione della scrittura.
      let runs = 0;
      for (let i = 0; i < 10; i += 1) {
        const stored = await panel.evaluate(() => chrome.storage.local.get('lmuse.usage.v1'));
        runs = stored['lmuse.usage.v1']?.runs ?? 0;
        if (runs >= 1) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      check("run completo: statistiche d'uso salvate", runs >= 1, `runs=${runs}`);
    }

    // LM-005: nuovo run deliberatamente bloccato dal mock provider.
    // Dopo la revoca del sito, il listener storage.onChanged del worker deve
    // abortire il run nonostante la permission Chrome sullo stesso host resti
    // valida per il provider su una porta distinta.
    await new Promise((r) => setTimeout(r, 5300)); // cooldown RUN documentato
    holdModelResponses = true;
    const revokeRunStarted = await panel.evaluate(`(function () {
      try {
        window.__lmuseRevokeProbe = { running: false, idle: false, done: false, errors: [] };
        var p = chrome.runtime.connect({ name: 'lmuse' });
        window.__lmuseRevokePort = p;
        p.onMessage.addListener(function (m) {
          if (!m) return;
          if (m.type === 'STATUS') {
            if (m.running) window.__lmuseRevokeProbe.running = true;
            if (!m.running && window.__lmuseRevokeProbe.running) window.__lmuseRevokeProbe.idle = true;
          }
          if (m.type === 'DONE') window.__lmuseRevokeProbe.done = true;
          if (m.type === 'ERROR') window.__lmuseRevokeProbe.errors.push(m.message);
        });
        p.postMessage({ type: 'RUN', task: 'Test sintetico di revoca attiva' });
        return 'ok';
      } catch (error) {
        return String(error);
      }
    })()`);
    check('LM-005: secondo run avviato da Port reale', revokeRunStarted === 'ok');
    for (let attempt = 0; attempt < 45 && !heldModelRequest; attempt++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    check('LM-005: richiesta provider rimane pendente prima della revoca', heldModelRequest);

    // Revoca del solo SITO tramite UI: il permesso Chrome non può sparire
    // finché un provider sullo stesso hostname ha ancora una capability valida.
    await panel.bringToFront();
    if (!(await panel.$(sitePermissionSelector))) {
      await panel.click('button[aria-label="Impostazioni"],button[aria-label="Settings"]');
    }
    await panel.waitForSelector(sitePermissionSelector, { timeout: 15_000 });
    await panel.type(sitePermissionSelector, testUrl);
    check(
      'pulsante revoca sito disponibile',
      await clickPanelButton(panel, ['Revoca permesso sito', 'Revoke website permission']),
    );
    const siteRoleRevoked = await waitForHostRole(panel, new URL(testUrl).origin, 'site', false);
    check('site permission revoked in LMuse role registry', siteRoleRevoked);
    let runStoppedAfterRevoke = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      runStoppedAfterRevoke = await panel
        .evaluate('Boolean(window.__lmuseRevokeProbe && window.__lmuseRevokeProbe.idle)')
        .catch(() => false);
      if (runStoppedAfterRevoke) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const revokeProbeState = await panel.evaluate('window.__lmuseRevokeProbe');
    check('LM-005: revoca interrompe il run attivo', runStoppedAfterRevoke, JSON.stringify(revokeProbeState));
    check('LM-005: nessun DONE dopo revoca del sito', revokeProbeState?.done === false);
    holdModelResponses = false;
    for (const response of heldResponses) response.destroy();
    check(
      'provider grant retained after site revoke',
      await hostRolePresent(panel, providerOrigin, 'provider'),
    );
    const stillPermittedByChrome = await checkHostPermission(testUrl);
    check('Chrome hostname permission shared with still-authorized provider', stillPermittedByChrome);
    check(
      'pulsante revoca API disponibile',
      await clickPanelButton(panel, ['Revoca API del provider', 'Revoke AI provider API']),
    );
    check(
      'provider role revoked in LMuse registry',
      await waitForHostRole(panel, providerOrigin, 'provider', false),
    );
    const revokeResult = await panel.evaluate(async (url) => {
      const origin = new URL(url);
      const pattern = origin.protocol + '//' + origin.hostname + '/*';
      const all = await chrome.storage.local.get('lmuse.hostGrants.v1');
      return {
        roles: all['lmuse.hostGrants.v1'] ?? [],
        chromeGranted: await chrome.permissions.contains({ origins: [pattern] }),
      };
    }, testUrl);
    check(
      'after last role revoke Chrome eliminates the host permission',
      !revokeResult.chromeGranted && revokeResult.roles.length === 0,
      JSON.stringify(revokeResult),
    );
    const tabMetadataAfterRevoke = await workerNow.evaluate(async (tabUrl) => {
      const tabs = await chrome.tabs.query({});
      return !tabs.some((tab) => tab.url === tabUrl || tab.title === 'Pagina di prova');
    }, testUrl);
    check('LM-004: URL e titolo tab nascosti dopo revoca', tabMetadataAfterRevoke);
    const deniedAfterRevoke = await workerNow.evaluate(async (tabId) => {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        return false;
      } catch {
        return true;
      }
    }, authorizedTabId);
    check('Chrome blocca nuove iniezioni dopo la revoca', deniedAfterRevoke);

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
