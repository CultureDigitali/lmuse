// Modelli gratuiti: OpenRouter espone il router `openrouter/free` e le varianti
// `:free`; NVIDIA NIM è gratuito in prova su tutti i modelli (rate limit ~40 RPM).
// Le funzioni sono pure e testate; il worker le usa per impedire per errore
// l'uso di modelli a pagamento quando l'utente ha scelto "solo gratuiti".

import type { ProviderId } from './settings';

export const FREE_ROUTER_MODEL = 'openrouter/free';

/** True se il modello OpenRouter è a costo zero (router o variante :free). */
export function isFreeOpenRouterModel(modelId: string): boolean {
  const id = (modelId ?? '').trim().toLowerCase();
  if (!id) return false;
  return id === FREE_ROUTER_MODEL || id.endsWith(':free');
}

/**
 * True se il modello è utilizzabile senza costi per il provider indicato.
 * - openrouter: router free o suffisso :free
 * - nvidia: tutti i modelli hosted sono free tier
 * - altri provider: nessuna nozione di free (nessun blocco)
 */
export function isFreeModel(providerId: ProviderId, modelId: string): boolean {
  if (providerId === 'openrouter') return isFreeOpenRouterModel(modelId);
  if (providerId === 'nvidia') return true;
  return false;
}

/** Filtra una lista di modelli per il provider (solo free quando richiesto). */
export function filterFreeModels(providerId: ProviderId, models: string[]): string[] {
  if (providerId !== 'openrouter') return [...models];
  return models.filter(isFreeOpenRouterModel);
}

/**
 * Motivo per cui il modello non è ammesso con "solo gratuiti", oppure null.
 * Solo OpenRouter ha modelli a pagamento selezionabili: NVIDIA è free tier.
 */
export function freeModelProblem(providerId: ProviderId, modelId: string, freeOnly: boolean): string | null {
  if (!freeOnly) return null;
  if (providerId === 'openrouter' && !isFreeOpenRouterModel(modelId)) {
    return `Con "solo modelli gratuiti" attivo, OpenRouter accetta solo "${FREE_ROUTER_MODEL}" o modelli con suffisso ":free". Scelta attuale: "${modelId || '(vuoto)'}".`;
  }
  return null;
}

/** Provider con un free tier utilizzabile per i task dell'agente. */
export function hasFreeTier(providerId: ProviderId): boolean {
  return providerId === 'openrouter' || providerId === 'nvidia';
}
