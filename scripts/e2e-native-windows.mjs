// True Chrome -> Windows Native Messaging integration, on a disposable
// GitHub-hosted Windows runner only. Never run on a developer's Windows PC:
// the installer writes to HKCU, even with an isolated Chrome user-data-dir.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, computeExecutablePath, install } from '@puppeteer/browsers';
import puppeteer from 'puppeteer-core';

if (
  process.platform !== 'win32' ||
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUNNER_OS !== 'Windows' ||
  process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
  process.env.LMUSE_CI_NATIVE_WINDOWS !== '1'
) {
  throw new Error('Windows Native Messaging E2E requires a disposable GitHub-hosted Windows runner.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const script = join(root, 'scripts', 'setup-opencode-bridge.mjs');
const hostName = 'it.lmuse.opencode_bridge';
const registryPath = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + hostName;
const version = readFileSync(join(root, 'scripts', 'e2e-smoke.mjs'), 'utf8').match(
  /export const BROWSER_VERSION = '([^']+)'/,
)?.[1];
assert.ok(version, 'Pinned Chrome for Testing version required');
assert.ok(existsSync(join(dist, 'manifest.json')), 'Run pnpm build before the Windows E2E test');

const work = mkdtempSync(join(tmpdir(), 'lmuse-native-ci-win-'));
const localAppData = join(work, 'isolated appdata');
const profile = join(work, 'isolated browser profile');
const cacheDir = join(work, 'chrome-cache');
const fakeFile = join(work, 'synthetic-auth.json');
const fakeKey = 'LMUSE-WINDOWS-E2E-FAKE-NOT-A-REAL-KEY';
mkdirSync(localAppData, { recursive: true });
writeFileSync(fakeFile, JSON.stringify({ openai: { type: 'api', key: fakeKey } }), {
  mode: 0o600,
});

const env = {
  ...process.env,
  LOCALAPPDATA: localAppData,
  OPENCODE_AUTH_JSON: fakeFile,
};
let browser;
let installerAttempted = false;

function check(label, condition) {
  assert.ok(condition, label);
  console.log('ok e2e-win: ' + label);
}

function register(extensionId) {
  installerAttempted = true;
  execFileSync(process.execPath, [script, '--extension-id=' + extensionId], {
    cwd: root,
    env,
    windowsHide: true,
    timeout: 90_000,
  });
}

async function launchBrowser(executablePath) {
  const launched = await puppeteer.launch({
    executablePath,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    env,
    args: [
      '--disable-extensions-except=' + dist,
      '--load-extension=' + dist,
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + profile,
    ],
  });
  return launched;
}

async function sendNative(page, cmd) {
  return page.evaluate(async (command) => {
    return chrome.runtime.sendNativeMessage('it.lmuse.opencode_bridge', { cmd: command });
  }, cmd);
}

try {
  // A hosted runner must not have an existing registration to overwrite.
  const preExisting = spawnSync('reg.exe', ['QUERY', registryPath, '/ve'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  check('Windows registry starts without a user native-host registration', preExisting.status !== 0);

  await install({ browser: Browser.CHROME, buildId: version, cacheDir });
  const executablePath = computeExecutablePath({
    browser: Browser.CHROME,
    buildId: version,
    cacheDir,
  });
  check('Pinned Chrome for Testing downloaded', existsSync(executablePath));

  browser = await launchBrowser(executablePath);
  const sw = await browser.waitForTarget(
    (target) => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
    { timeout: 35_000 },
  );
  const extensionId = new URL(sw.url()).hostname;
  check('Unpacked extension ID is valid', /^[a-p]{32}$/.test(extensionId));

  register(extensionId);
  const manifestPath = join(localAppData, 'LMuse', 'native', hostName + '.json');
  check('Native host manifest installed under temporary LOCALAPPDATA', existsSync(manifestPath));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(
    'Native host origin pinned to the exact unpacked extension',
    manifest.allowed_origins?.length === 1 &&
      manifest.allowed_origins[0] === 'chrome-extension://' + extensionId + '/' &&
      manifest.path.endsWith('.exe') &&
      existsSync(manifest.path),
  );
  const registration = spawnSync('reg.exe', ['QUERY', registryPath, '/ve'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  check(
    'Windows HKCU points to the temporary native-host manifest',
    registration.status === 0 && registration.stdout.includes(manifestPath),
  );

  const page = await browser.newPage();
  await page.goto('chrome-extension://' + extensionId + '/sidepanel/index.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction('document.readyState === "complete" && !!chrome.runtime.id', {
    timeout: 20_000,
  });

  // Every sendNativeMessage starts the genuine compiled C# EXE and its Node
  // process. All secrets come from OPENCODE_AUTH_JSON in this disposable VM.
  const ping = await sendNative(page, 'ping');
  check('Chrome -> Windows native EXE -> Node ping', ping?.ok === true && ping.version === 1);

  const listing = await sendNative(page, 'list');
  check(
    'Native list exposes provider metadata but no keys',
    listing?.ok === true &&
      listing.providers?.[0]?.id === 'openai' &&
      !JSON.stringify(listing).includes(fakeKey),
  );

  const exported = await sendNative(page, 'export');
  check(
    'Native export contains exactly one synthetic credential',
    exported?.ok === true &&
      exported.credentials?.length === 1 &&
      exported.credentials[0].id === 'openai' &&
      exported.credentials[0].key === fakeKey,
  );

  const denied = await sendNative(page, 'delete-all');
  check(
    'Windows native host rejects unsupported commands',
    denied?.ok === false && denied.error === 'unknown-command',
  );
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (installerAttempted) {
    // The runner registry is ephemeral, but remove the exact host entries so
    // even a failing test leaves no capability behind on this runner.
    execFileSync(process.execPath, [script, '--uninstall'], {
      cwd: root,
      env,
      windowsHide: true,
      timeout: 30_000,
    });
    const after = spawnSync('reg.exe', ['QUERY', registryPath, '/ve'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    check('Windows native host registration removed after test', after.status !== 0);
  }
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch {
    // Chrome for Testing cache may still be held briefly by antivirus; the
    // entire GitHub-hosted runner is discarded after this job.
  }
}
