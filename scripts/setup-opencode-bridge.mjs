#!/usr/bin/env node
// Installa (o rimuove con --uninstall) il native messaging host del bridge
// opencode per lmuse: manifest JSON nelle cartelle NativeMessagingHosts
// di Chrome/Chromium/Edge, puntando allo script Node di questo repo.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HOST_NAME = 'it.lmuse.opencode_bridge';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const bridgePath = join(root, 'native', 'lmuse-opencode-bridge.mjs');
const uninstall = process.argv.includes('--uninstall');
const extId = (process.argv.find((a) => a.startsWith('--extension-id=')) ?? '').split('=')[1] ?? '';

function nodePath() {
  try {
    return execFileSync('which', ['node'], { encoding: 'utf8' }).trim();
  } catch {
    return process.execPath;
  }
}

function hostDirs() {
  const os = platform();
  const home = homedir();
  if (os === 'darwin') {
    return [
      join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
    ];
  }
  if (os === 'linux') {
    return [
      join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
      join(home, '.config', 'chromium', 'NativeMessagingHosts'),
      join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts'),
    ];
  }
  return []; // windows: richiede registro, non supportato da questo script
}

if (uninstall) {
  for (const dir of hostDirs()) {
    const f = join(dir, `${HOST_NAME}.json`);
    if (existsSync(f)) {
      unlinkSync(f);
      console.log('Rimosso:', f);
    }
  }
  process.exit(0);
}

const manifest = {
  name: HOST_NAME,
  description: 'lmuse opencode bridge: legge auth.json di opencode (solo locale).',
  path: bridgePath,
  type: 'stdio',
  allowed_origins: extId ? [`chrome-extension://${extId}/`] : ['chrome-extension://<ID-ESTENSIONE>/'],
};

let written = 0;
for (const dir of hostDirs()) {
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${HOST_NAME}.json`);
  writeFileSync(f, JSON.stringify(manifest, null, 2));
  console.log('Scritto:', f);
  written++;
}
if (!written) {
  console.error('Piattaforma non supportata da questo script (Windows: registra a mano).');
  process.exit(1);
}
console.log('HOST_NAME =', HOST_NAME);
if (!extId) {
  console.warn('Nota: passa --extension-id=<id> per allowed_origins reale,');
  console.warn('oppure modifica i JSON appena scritti sostituendo <ID-ESTENSIONE>.');
}
void readFileSync; // keep unused import honest
console.log('Node usato:', nodePath());
