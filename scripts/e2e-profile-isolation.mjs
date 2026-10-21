// LM-006: two real Chrome profiles, one installed extension ID, separate
// browser processes, synthetic storage and no access to the user's profiles.
// Run on Chrome for Testing only. Never uses auth.json or system credentials.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, computeExecutablePath } from '@puppeteer/browsers';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const version = readFileSync(join(root, 'scripts', 'e2e-smoke.mjs'), 'utf8').match(
  /export const BROWSER_VERSION = '([^']+)'/,
)?.[1];
assert.ok(version, 'Versione Chrome for Testing non trovata');
assert.ok(existsSync(join(dist, 'manifest.json')), 'Build dist assente: esegui pnpm build');
const executablePath =
  process.env.CHROME_PATH ||
  computeExecutablePath({
    browser: Browser.CHROME,
    buildId: version,
    cacheDir: join(homedir(), '.cache', 'puppeteer'),
  });
assert.ok(existsSync(executablePath), 'Chrome for Testing pinnato non installato');
const rootTemp = mkdtempSync(join(tmpdir(), 'lmuse-profile-isolation-'));
const browsers = [];

const LOCAL_KEY = 'lmuse.keys.v2';
const SETTINGS_KEY = 'lmuse.settings.v1';
const HOST_GRANTS_KEY = 'lmuse.hostGrants.v1';
const INBOX_KEY = 'lmuse.inbox.v1';
const TEST_A_LOCAL = 'LMUSE-LM006-FAKE-LOCAL-A-NOT-CREDENTIAL';
const TEST_A_SESSION = 'LMUSE-LM006-FAKE-SESSION-A-NOT-CREDENTIAL';
const TEST_B_LOCAL = 'LMUSE-LM006-FAKE-LOCAL-B-NOT-CREDENTIAL';
const TEST_B_SESSION = 'LMUSE-LM006-FAKE-SESSION-B-NOT-CREDENTIAL';

function check(label, condition, detail = '') {
  assert.ok(condition, label + (detail ? ': ' + detail : ''));
  console.log('ok e2e-profiles: ' + label);
}

async function openProfile(name) {
  const dir = join(rootTemp, 'profile-' + name);
  mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--disable-extensions-except=' + dist,
      '--load-extension=' + dist,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--user-data-dir=' + dir,
    ],
  });
  browsers.push(browser);
  const worker = await browser.waitForTarget(
    (target) => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
    { timeout: 30_000 },
  );
  const extensionId = new URL(worker.url()).hostname;
  check('estensione attiva nel profilo ' + name, /^[a-p]{32}$/.test(extensionId));
  const page = await browser.newPage();
  await page.goto('chrome-extension://' + extensionId + '/sidepanel/index.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction('document.readyState === "complete" && !!chrome.runtime.id', {
    timeout: 20_000,
  });
  return { browser, extensionId, page };
}

async function storageSnapshot(profile) {
  return profile.page.evaluate(async () => {
    const local = await chrome.storage.local.get(null);
    const session = await chrome.storage.session.get(null);
    return { local, session };
  });
}

async function putSyntheticData(profile, localKey, sessionKey, domain) {
  return profile.page.evaluate(
    async ({ localKey, sessionKey, domain }) => {
      await chrome.storage.local.set({
        'lmuse.keys.v2': { openai: localKey },
        'lmuse.hostGrants.v1': [{ origin: domain, purpose: 'site', grantedAt: 1 }],
        'lmuse.settings.v1': { providerId: 'custom', privacyMode: 'strict', marker: localKey },
      });
      await chrome.storage.session.set({
        'lmuse.keys.v2': { anthropic: sessionKey },
        'lmuse.inbox.v1': { text: sessionKey, steps: 1, at: 1 },
      });
    },
    { localKey, sessionKey, domain },
  );
}

async function closeProfile(profile) {
  await profile.browser.close();
  const index = browsers.indexOf(profile.browser);
  if (index >= 0) browsers.splice(index, 1);
}

try {
  const a = await openProfile('a');
  const b = await openProfile('b');
  check('stesso ID estensione nei due profili isolati', a.extensionId === b.extensionId);

  await putSyntheticData(a, TEST_A_LOCAL, TEST_A_SESSION, 'https://a.example.test');
  const firstA = await storageSnapshot(a);
  const firstB = await storageSnapshot(b);
  check('chiave locale A presente soltanto in A', firstA.local[LOCAL_KEY]?.openai === TEST_A_LOCAL);
  check(
    'chiave di sessione A presente soltanto in A',
    firstA.session[LOCAL_KEY]?.anthropic === TEST_A_SESSION,
  );
  check(
    'B non eredita impostazioni, chiavi, grant o inbox del profilo A',
    ![LOCAL_KEY, SETTINGS_KEY, HOST_GRANTS_KEY].some((key) =>
      JSON.stringify(firstB.local[key] ?? '').includes(TEST_A_LOCAL),
    ) &&
      !JSON.stringify(firstB.local).includes('https://a.example.test') &&
      !JSON.stringify(firstB.session).includes(TEST_A_SESSION),
  );

  await putSyntheticData(b, TEST_B_LOCAL, TEST_B_SESSION, 'https://b.example.test');
  const finalA = await storageSnapshot(a);
  const finalB = await storageSnapshot(b);
  check('B mantiene la propria chiave locale', finalB.local[LOCAL_KEY]?.openai === TEST_B_LOCAL);
  check('B mantiene la propria chiave di sessione', finalB.session[LOCAL_KEY]?.anthropic === TEST_B_SESSION);
  check(
    'i grant per origin sono separati',
    finalA.local[HOST_GRANTS_KEY]?.[0]?.origin === 'https://a.example.test' &&
      finalB.local[HOST_GRANTS_KEY]?.[0]?.origin === 'https://b.example.test',
  );
  check(
    'modifiche B non alterano chiavi e inbox A',
    finalA.local[LOCAL_KEY]?.openai === TEST_A_LOCAL &&
      finalA.session[LOCAL_KEY]?.anthropic === TEST_A_SESSION &&
      finalA.session[INBOX_KEY]?.text === TEST_A_SESSION,
  );
  check(
    'modifiche A e B non contaminano gli altri profili',
    !JSON.stringify(finalA).includes(TEST_B_LOCAL) &&
      !JSON.stringify(finalA).includes(TEST_B_SESSION) &&
      !JSON.stringify(finalB).includes(TEST_A_LOCAL) &&
      !JSON.stringify(finalB).includes(TEST_A_SESSION),
  );

  // Same profile, another panel: storage.session is shared by design within
  // one profile. It must not be shared across profiles.
  const anotherPanel = await a.browser.newPage();
  await anotherPanel.goto('chrome-extension://' + a.extensionId + '/sidepanel/index.html');
  const sameProfile = await anotherPanel.evaluate(async () => {
    const current = await chrome.storage.session.get('lmuse.keys.v2');
    return current['lmuse.keys.v2']?.anthropic;
  });
  check('sessione condivisa solo dentro lo stesso profilo', sameProfile === TEST_A_SESSION);
  await anotherPanel.close();

  await closeProfile(a);
  await closeProfile(b);
  // A fresh browser process, but the same profile directory, must preserve
  // only persistent storage. Session keys and inbox must be discarded.
  const reopenedA = await openProfile('a');
  const afterRestartA = await storageSnapshot(reopenedA);
  check(
    'impostazioni e chiave locale A persistono dopo il riavvio',
    afterRestartA.local[LOCAL_KEY]?.openai === TEST_A_LOCAL &&
      afterRestartA.local[HOST_GRANTS_KEY]?.[0]?.origin === 'https://a.example.test',
  );
  check(
    'chiave e inbox di sessione A cancellati al riavvio',
    !JSON.stringify(afterRestartA.session).includes(TEST_A_SESSION),
  );
  await closeProfile(reopenedA);
  const reopenedB = await openProfile('b');
  const afterRestartB = await storageSnapshot(reopenedB);
  check(
    'impostazioni e chiave locale B persistono dopo il riavvio',
    afterRestartB.local[LOCAL_KEY]?.openai === TEST_B_LOCAL &&
      afterRestartB.local[HOST_GRANTS_KEY]?.[0]?.origin === 'https://b.example.test',
  );
  check(
    'chiave e inbox di sessione B cancellati al riavvio',
    !JSON.stringify(afterRestartB.session).includes(TEST_B_SESSION),
  );
  await closeProfile(reopenedB);
} finally {
  for (const browser of browsers) await browser.close().catch(() => undefined);
  rmSync(rootTemp, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
console.log('e2e-profiles: tutti i controlli passati.');
