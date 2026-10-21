// LM-003: integration test for the ACTUAL installed native host executable.
// Only synthetic credentials and a --dry-run installation directory are used.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const EXT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SCRIPT = resolve(process.cwd(), 'scripts', 'setup-opencode-bridge.mjs');
const HOST = 'it.lmuse.opencode_bridge';
const SECRET = 'LMUSE-FICTITIOUS-KEY-NOT-A-REAL-CREDENTIAL';

interface NativeManifest {
  name: string;
  path: string;
  type: string;
  allowed_origins: string[];
}

let directory = '';
let manifest: NativeManifest;

function command(command: string, authPath?: string): { response: Record<string, unknown>; output: Buffer } {
  const data = Buffer.from(JSON.stringify({ cmd: command }));
  const frame = Buffer.alloc(data.length + 4);
  frame.writeUInt32LE(data.length, 0);
  data.copy(frame, 4);
  const run = spawnSync(manifest.path, [], {
    input: frame,
    timeout: 15_000,
    windowsHide: true,
    env: { ...process.env, OPENCODE_AUTH_JSON: authPath ?? join(directory, 'missing-auth.json') },
    maxBuffer: 2 * 1024 * 1024,
  });
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(0);
  expect(run.stdout.length).toBeGreaterThanOrEqual(4);
  const length = run.stdout.readUInt32LE(0);
  expect(length).toBeGreaterThan(0);
  expect(run.stdout.length).toBe(length + 4);
  const parsed = JSON.parse(run.stdout.subarray(4).toString('utf8')) as Record<string, unknown>;
  return { response: parsed, output: run.stdout };
}

describe('LM-003 nativeMessaging host pinning and local installation', () => {
  beforeAll(() => {
    const run = spawnSync(process.execPath, [SCRIPT, '--dry-run', `--extension-id=${EXT_ID}`], {
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
    });
    expect(run.status, run.stderr).toBe(0);
    const match = run.stdout.match(/DRY_RUN_DIR = (.+)/);
    expect(match).not.toBeNull();
    directory = match![1]!.trim();
    const path = join(directory, 'NativeMessagingHosts', HOST + '.json');
    expect(existsSync(path)).toBe(true);
    manifest = JSON.parse(readFileSync(path, 'utf8')) as NativeManifest;
  }, 75_000);

  afterAll(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('pins ONE actual extension ID with no wildcard and a real installed executable', () => {
    expect(manifest.name).toBe(HOST);
    expect(manifest.type).toBe('stdio');
    expect(manifest.allowed_origins).toEqual([`chrome-extension://${EXT_ID}/`]);
    expect(manifest.path).toContain(directory);
    expect(existsSync(manifest.path)).toBe(true);
    if (platform() !== 'win32') expect(statSync(manifest.path).mode & 0o111).not.toBe(0);
    if (platform() === 'win32') expect(manifest.path).toMatch(/\.exe$/i);
  });

  it('rejects an unpinned or malformed extension ID without manifest output', () => {
    const run = spawnSync(process.execPath, [SCRIPT, '--dry-run', '--extension-id=not-an-extension'], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('ID estensione Chrome obbligatorio');
    expect(run.stdout).not.toContain('Scritto:');
  });

  it('uninstalls without the repository native source files', () => {
    const isolatedRoot = join(directory, 'source-less-checkout');
    const isolatedScript = join(isolatedRoot, 'scripts', 'setup-opencode-bridge.mjs');
    mkdirSync(dirname(isolatedScript), { recursive: true });
    copyFileSync(SCRIPT, isolatedScript);
    const run = spawnSync(process.execPath, [isolatedScript, '--uninstall', '--dry-run'], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    });
    expect(run.status, run.stderr).toBe(0);
  });

  it('stdio framing and ping work via the installed native binary', () => {
    expect(command('ping').response).toEqual({ ok: true, version: 1 });
    expect(command('delete-all').response).toEqual({ ok: false, error: 'unknown-command' });
  });

  it('list never sends secrets, export only returns keys in its explicit response', () => {
    const authPath = join(directory, 'mock-auth.json');
    writeFileSync(
      authPath,
      JSON.stringify({ openai: { type: 'api', key: SECRET }, anthropic: { type: 'api' } }),
      'utf8',
    );
    const listing = command('list', authPath);
    expect(listing.response.ok).toBe(true);
    expect(listing.output.toString()).not.toContain(SECRET);
    expect(listing.response.providers).toEqual([
      { id: 'openai', type: 'api' },
      { id: 'anthropic', type: 'api' },
    ]);
    const exported = command('export', authPath);
    expect(exported.response.credentials).toEqual([{ id: 'openai', key: SECRET }]);
  });
});
