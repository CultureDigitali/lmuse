import { describe, expect, it } from 'vitest';
import {
  FREE_ROUTER_MODEL,
  filterFreeModels,
  freeModelProblem,
  hasFreeTier,
  isFreeModel,
  isFreeOpenRouterModel,
} from './free-models';

describe('isFreeOpenRouterModel', () => {
  it('router free e varianti :free', () => {
    expect(isFreeOpenRouterModel(FREE_ROUTER_MODEL)).toBe(true);
    expect(isFreeOpenRouterModel('google/gemma-4-31b-it:free')).toBe(true);
    expect(isFreeOpenRouterModel(' NVIDIA/Nemotron-3.5-Lightning:FREE ')).toBe(true);
  });
  it('modelli a pagamento e vuoti no', () => {
    expect(isFreeOpenRouterModel('anthropic/claude-sonnet-5')).toBe(false);
    expect(isFreeOpenRouterModel('openrouter/auto')).toBe(false);
    expect(isFreeOpenRouterModel('')).toBe(false);
  });
});

describe('isFreeModel', () => {
  it('openrouter filtra, nvidia è tutto free, altri senza nozione', () => {
    expect(isFreeModel('openrouter', 'openrouter/free')).toBe(true);
    expect(isFreeModel('openrouter', 'openai/gpt-5.6')).toBe(false);
    expect(isFreeModel('nvidia', 'qualsiasi/modello')).toBe(true);
    expect(isFreeModel('openai', 'gpt-5.6')).toBe(false);
  });
});

describe('filterFreeModels', () => {
  it('openrouter tiene solo free, preserva ordine', () => {
    expect(filterFreeModels('openrouter', ['a/b', 'x/y:free', FREE_ROUTER_MODEL, 'c/d'])).toEqual([
      'x/y:free',
      FREE_ROUTER_MODEL,
    ]);
  });
  it.each(['nvidia', 'openai', 'custom'] as const)('%s: lista invariata', (provider) => {
    expect(filterFreeModels(provider, ['m1', 'm2'])).toEqual(['m1', 'm2']);
  });
});

describe('freeModelProblem', () => {
  it('nessun blocco se freeOnly off', () => {
    expect(freeModelProblem('openrouter', 'openai/gpt-5.6', false)).toBeNull();
  });
  it('openrouter: blocca i paid, ammette free', () => {
    expect(freeModelProblem('openrouter', 'openai/gpt-5.6', true)).toMatch(/solo modelli gratuiti/i);
    expect(freeModelProblem('openrouter', FREE_ROUTER_MODEL, true)).toBeNull();
  });
  it('nvidia e altri provider non vengono bloccati', () => {
    expect(freeModelProblem('nvidia', 'nvidia/nemotron-3-super-120b-a12b', true)).toBeNull();
    expect(freeModelProblem('openai', 'gpt-5.6', true)).toBeNull();
  });
});

describe('hasFreeTier', () => {
  it('solo openrouter e nvidia', () => {
    expect(hasFreeTier('openrouter')).toBe(true);
    expect(hasFreeTier('nvidia')).toBe(true);
    expect(hasFreeTier('openai')).toBe(false);
  });
});
