// Integrazione opencode: validazione zod del payload del native bridge
// e mapping opencode provider id → lmuse ProviderId.
// Le chiavi (credenziali exportate) NON passano mai in questi tipi di dominio
// senza validazione e non finiscono mai in log o messaggi d'errore.

import { z } from 'zod';
import { PROVIDERS, type ProviderId } from './settings';

export const BridgeProviderSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().max(16),
});

export const BridgeCredentialSchema = z.object({
  id: z.string().min(1).max(64),
  key: z.string().min(1).max(4096),
});

export const BridgePayloadSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    version: z.number().optional(),
    providers: z.array(BridgeProviderSchema).max(100).optional(),
    credentials: z.array(BridgeCredentialSchema).max(100).optional(),
  }),
  z.object({ ok: z.literal(false), error: z.string().max(120) }),
]);

export type BridgePayload = z.infer<typeof BridgePayloadSchema>;
export type BridgeCredential = z.infer<typeof BridgeCredentialSchema>;

const PROVIDER_BY_OPENCODE_ID = new Map<string, ProviderId>(
  PROVIDERS.filter((p) => p.opencodeId).map((p) => [p.opencodeId as string, p.id]),
);

/** Credenziali esportate da opencode → Record providerId lmuse → chiave. */
export function mapBridgeCredentials(creds: BridgeCredential[]): Partial<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = {};
  for (const c of creds) {
    const target = PROVIDER_BY_OPENCODE_ID.get(c.id);
    if (target && !out[target]) out[target] = c.key;
  }
  return out;
}

/** Quali provider sono presenti in opencode (per la card di stato). */
export function matchBridgeProviders(ids: string[]): ProviderId[] {
  const found = new Set<ProviderId>();
  for (const id of ids) {
    const target = PROVIDER_BY_OPENCODE_ID.get(id);
    if (target) found.add(target);
  }
  return [...found];
}

/** Messaggio errore bridge → chiave i18n (mai contenuto con segreti). */
export function bridgeErrorKey(code: string): string {
  switch (code) {
    case 'auth-json-missing':
      return 'opencode_err_no_auth';
    case 'auth-json-invalid':
    case 'invalid-auth-json':
      return 'opencode_err_bad_auth';
    case 'bad-request':
    case 'bad-json':
    case 'unknown-command':
      return 'opencode_err_protocol';
    default:
      return 'opencode_err_generic';
  }
}
