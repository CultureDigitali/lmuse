// Export/import profilo: settings senza chiave, con validazione.
// La chiave API non è mai inclusa (non vive in Settings per design).

import { sanitizeSettings, type Settings } from './settings';

export const PROFILE_MAX_BYTES = 100_000;

export interface ExportedProfile {
  app: 'lmuse';
  version: number;
  exportedAt: number;
  settings: Settings;
}

/** Costruisce il profilo esportabile (mai la chiave: non è in Settings). */
export function exportProfile(settings: Settings): ExportedProfile {
  return { app: 'lmuse', version: 1, exportedAt: Date.now(), settings: sanitizeSettings(settings) };
}

/**
 * Valida un profilo importato: shape check + cap size + sanitize.
 * Rifiuta non-oggetti, JSON giganti e shape errate; scarta chiavi ignote
 * (inclusa un'eventuale `apiKey` contrabbandata).
 */
export function validateProfile(data: unknown): Settings {
  const json = JSON.stringify(data ?? null);
  if (json.length > PROFILE_MAX_BYTES) throw new Error('File troppo grande (max 100KB).');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Formato profilo non valido.');
  }
  const record = data as Record<string, unknown>;
  if (record['app'] !== 'lmuse' || typeof record['settings'] !== 'object' || !record['settings']) {
    throw new Error('Formato profilo non valido: manca settings lmuse.');
  }
  return sanitizeSettings(record['settings'] as Partial<Settings>);
}
