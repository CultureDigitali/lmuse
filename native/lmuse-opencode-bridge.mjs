#!/usr/bin/env node
/**
 * lmuse ↔ opencode native messaging host.
 *
 * Protocollo: messaggi JSON prefissati da lunghezza uint32 little-endian
 * (stdin/stdout), come da specifica Chrome native messaging.
 *
 * Comandi:
 *   { cmd: 'ping' }   → { ok: true, version }
 *   { cmd: 'list' }   → { ok: true, providers: [{ id, type }] }   (mai chiavi)
 *   { cmd: 'export' } → { ok: true, credentials: [{ id, key }] }  (solo valori 'key')
 *
 * Fonte: ~/.local/share/opencode/auth.json (o OPENCODE_AUTH_JSON per i test).
 * Il bridge non scrive nulla, non fa rete, non logga segreti: solo stderr sanitizzato.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERSION = 1;
const MAX_MSG = 1024 * 1024; // 1 MiB: oltre è un bug o un attacco

function authPath() {
  return process.env.OPENCODE_AUTH_JSON || join(homedir(), '.local', 'share', 'opencode', 'auth.json');
}

function fail(error) {
  return { ok: false, error };
}

async function readAuth() {
  try {
    const raw = await readFile(authPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail('invalid-auth-json');
    return { ok: true, data: parsed };
  } catch (err) {
    if (err && err.code === 'ENOENT') return fail('auth-json-missing');
    if (err instanceof SyntaxError) return fail('auth-json-invalid');
    return fail('read-error');
  }
}

async function handle(msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.cmd !== 'string') return fail('bad-request');
  switch (msg.cmd) {
    case 'ping':
      return { ok: true, version: VERSION };
    case 'list': {
      const auth = await readAuth();
      if (!auth.ok) return auth;
      const providers = Object.entries(auth.data).map(([id, v]) => ({
        id: String(id).slice(0, 64),
        type: v && typeof v === 'object' && typeof v.type === 'string' ? v.type.slice(0, 16) : 'unknown',
      }));
      return { ok: true, providers };
    }
    case 'export': {
      const auth = await readAuth();
      if (!auth.ok) return auth;
      const credentials = [];
      for (const [id, v] of Object.entries(auth.data)) {
        if (v && typeof v === 'object' && typeof v.key === 'string' && v.key.trim()) {
          credentials.push({ id: String(id).slice(0, 64), key: v.key.trim().slice(0, 4096) });
        }
      }
      return { ok: true, credentials };
    }
    default:
      return fail('unknown-command');
  }
}

// --- framing uint32le ---

const stdin = process.stdin;
const stdout = process.stdout;
let buffer = Buffer.alloc(0);

function send(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stdout.write(Buffer.concat([header, payload]));
}

stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const len = buffer.readUInt32LE(0);
    if (len > MAX_MSG) {
      send(fail('message-too-large'));
      buffer = Buffer.alloc(0);
      continue;
    }
    if (buffer.length < 4 + len) break;
    const body = buffer.subarray(4, 4 + len);
    buffer = buffer.subarray(4 + len);
    let msg;
    try {
      msg = JSON.parse(body.toString('utf8'));
    } catch {
      send(fail('bad-json'));
      continue;
    }
    void handle(msg).then(send, () => send(fail('internal')));
  }
});
