#!/usr/bin/env node
// Installa (o rimuove con --uninstall) il native messaging host del bridge
// opencode per lmuse: manifest JSON nelle cartelle NativeMessagingHosts
// di Chrome/Chromium/Edge, puntando ad un launcher installato nello spazio utente.
// Non usa credenziali reali. --dry-run installa solo in una cartella temporanea,
// senza toccare la configurazione o il registro del browser.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, platform, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HOST_NAME = 'it.lmuse.opencode_bridge';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const bridgeSourcePath = join(root, 'native', 'lmuse-opencode-bridge.mjs');
const shimSourcePath = join(root, 'native', 'NativeHostShim.cs');
const uninstall = process.argv.includes('--uninstall');
const dryRun = process.argv.includes('--dry-run');
const extId = (process.argv.find((a) => a.startsWith('--extension-id=')) ?? '').split('=')[1] ?? '';
const windows = platform() === 'win32';

if (!uninstall && !/^[a-p]{32}$/.test(extId)) {
  console.error(
    'ID estensione Chrome obbligatorio: usa --extension-id=<32 lettere a-p> da chrome://extensions.',
  );
  process.exit(2);
}

const installDir = dryRun
  ? mkdtempSync(join(tmpdir(), 'lmuse-native-smoke-'))
  : windows
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'LMuse', 'native')
    : join(homedir(), '.local', 'share', 'lmuse', 'native');
const bridgePath = join(installDir, 'lmuse-opencode-bridge.mjs');
function nodePath() {
  return process.execPath;
}

/** Passa percorsi senza espansioni shell: il launcher contiene solo valori locali noti al setup. */
function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function psQuote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

const WINDOWS_HOST_REGISTRY = [
  'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + HOST_NAME,
  'HKCU\\Software\\Chromium\\NativeMessagingHosts\\' + HOST_NAME,
  'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\' + HOST_NAME,
];

function hostDirs() {
  if (dryRun) return [join(installDir, 'NativeMessagingHosts')];
  if (windows) return [installDir];
  const os = platform();
  const home = homedir();
  if (os === 'darwin') {
    return [
      join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
      // Chrome for Testing >=146 usa una directory host distinta da Chrome Stable.
      join(home, 'Library', 'Application Support', 'Google', 'ChromeForTesting', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
    ];
  }
  if (os === 'linux') {
    return [
      join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
      join(home, '.config', 'google-chrome-for-testing', 'NativeMessagingHosts'),
      join(home, '.config', 'chromium', 'NativeMessagingHosts'),
      join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts'),
    ];
  }
  return [];
}

if (uninstall) {
  if (windows && !dryRun) {
    for (const name of WINDOWS_HOST_REGISTRY) {
      try {
        execFileSync('reg.exe', ['DELETE', name, '/f'], { stdio: 'ignore' });
        console.log('Rimosso registro:', name);
      } catch {
        // La voce era probabilmente già assente.
      }
    }
  }
  for (const dir of hostDirs()) {
    const f = join(dir, `${HOST_NAME}.json`);
    if (existsSync(f)) {
      unlinkSync(f);
      console.log('Rimosso:', f);
    }
  }
  const unixLauncherPath = join(installDir, 'lmuse-opencode-host');
  if (existsSync(unixLauncherPath)) unlinkSync(unixLauncherPath);
  if (existsSync(bridgePath)) unlinkSync(bridgePath);
  if (windows && existsSync(installDir)) {
    for (const name of readdirSync(installDir)) {
      if (/^lmuse-opencode-host-[0-9a-f]{12}\.exe$/.test(name)) {
        unlinkSync(join(installDir, name));
      }
    }
  }
  process.exit(0);
}

// A versioned Windows launcher can be reinstalled while an older process is
// still open, without overwriting an EXE locked by the browser. Compute the
// hash only for installation: uninstall must keep working after the checkout
// or its source files have been removed.
const versionHash = windows
  ? createHash('sha256')
      .update(process.execPath)
      .update(readFileSync(bridgeSourcePath))
      .update(readFileSync(shimSourcePath))
      .digest('hex')
      .slice(0, 12)
  : '';
const launcherPath = join(
  installDir,
  windows ? `lmuse-opencode-host-${versionHash}.exe` : 'lmuse-opencode-host',
);

const dirs = hostDirs();
if (dirs.length === 0) {
  console.error('Sistema operativo non supportato.');
  process.exit(1);
}

if (!existsSync(bridgeSourcePath)) throw new Error('Bridge originale non trovato nel repository.');
mkdirSync(installDir, { recursive: true, mode: 0o700 });
copyFileSync(bridgeSourcePath, bridgePath);
if (windows) {
  const source = readFileSync(shimSourcePath, 'utf8')
    .replace('__NODE_EXE__', JSON.stringify(nodePath()))
    .replace('__BRIDGE_FILE__', JSON.stringify(bridgePath));
  if (!existsSync(launcherPath)) {
    const sourcePath = join(installDir, 'NativeHostShim.generated.cs');
    writeFileSync(sourcePath, source, { mode: 0o600 });
    try {
      // Add-Type su PowerShell 5.1 compila un eseguibile .NET: Chrome richiede
      // un binary reale, non può avviare direttamente un .mjs/.cmd su Windows.
      const command =
        'Add-Type -Path ' +
        psQuote(sourcePath) +
        ' -OutputAssembly ' +
        psQuote(launcherPath) +
        ' -OutputType ConsoleApplication -ErrorAction Stop';
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
    } finally {
      if (existsSync(sourcePath)) unlinkSync(sourcePath);
    }
  }
} else {
  chmodSync(bridgePath, 0o700);
  writeFileSync(
    launcherPath,
    '#!/bin/sh\nexec ' + shellQuote(nodePath()) + ' ' + shellQuote(bridgePath) + '\n',
    { mode: 0o700 },
  );
  chmodSync(launcherPath, 0o700);
}

const manifest = {
  name: HOST_NAME,
  description: 'lmuse opencode bridge: legge auth.json di opencode (solo locale).',
  path: launcherPath,
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extId}/`],
};

for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${HOST_NAME}.json`);
  const temp = f + '.tmp-' + process.pid;
  writeFileSync(temp, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  renameSync(temp, f);
  console.log('Scritto:', f);
}
if (windows && !dryRun) {
  for (const registryPath of WINDOWS_HOST_REGISTRY) {
    execFileSync(
      'reg.exe',
      ['ADD', registryPath, '/ve', '/t', 'REG_SZ', '/d', join(installDir, `${HOST_NAME}.json`), '/f'],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
    );
    console.log('Registrato:', registryPath);
  }
}
console.log('HOST_NAME =', HOST_NAME);
console.log('Node usato:', nodePath());
if (dryRun) console.log('DRY_RUN_DIR =', installDir);
