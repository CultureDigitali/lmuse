import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createCerebras } from '@ai-sdk/cerebras';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createGateway } from '@ai-sdk/gateway';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createPerplexity } from '@ai-sdk/perplexity';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import type { Settings } from '../shared/settings';

/**
 * Crea il modello AI SDK v7 corrispondente alle impostazioni utente.
 *
 * Gli import sono STATICI e non dinamici, per una ragione che non è una scelta
 * di gusto: nei service worker di estensione MV3 `import()` non è supportato
 * (Chrome lo vieta esplicitamente, cfr. w3c/ServiceWorker#1356). Con
 * l'import dinamico ogni provider — quindi ogni task — moriva con
 * "import() is disallowed on ServiceWorkerGlobalScope". I provider OpenAI-
 * compatibili (OpenRouter, NVIDIA, OpenCode Zen, GitHub, Baseten, SambaNova,
 * Ollama, LM Studio, custom) passano da createOpenAICompatible con baseURL
 * configurabile. La chiave non vive nelle settings: arriva come parametro.
 */
export async function createModel(settings: Settings, apiKey: string): Promise<LanguageModel> {
  const { providerId, model, baseUrl } = settings;
  if (!model) throw new Error('Specifica il nome del modello nelle impostazioni.');

  const factories: Record<string, () => Promise<LanguageModel>> = {
    openai: async () => createOpenAI({ apiKey })(model),
    anthropic: async () => createAnthropic({ apiKey })(model),
    google: async () => createGoogleGenerativeAI({ apiKey })(model),
    xai: async () => createXai({ apiKey })(model),
    groq: async () => createGroq({ apiKey })(model),
    deepseek: async () => createDeepSeek({ apiKey })(model),
    cerebras: async () => createCerebras({ apiKey })(model),
    mistral: async () => createMistral({ apiKey })(model),
    cohere: async () => createCohere({ apiKey })(model),
    deepinfra: async () => createDeepInfra({ apiKey })(model),
    fireworks: async () => createFireworks({ apiKey })(model),
    perplexity: async () => createPerplexity({ apiKey })(model),
    togetherai: async () => createTogetherAI({ apiKey })(model),
    huggingface: async () => createHuggingFace({ apiKey })(model),
    gateway: async () => createGateway({ apiKey })(model),
    azure: async () => {
      if (!baseUrl) throw new Error('Azure OpenAI richiede il base URL (endpoint risorsa).');
      return createAzure({ apiKey, baseURL: baseUrl })(model);
    },
    openrouter: async () =>
      createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL: baseUrl || 'https://openrouter.ai/api/v1',
        // Nessun referer falso: solo il nome del prodotto. (P28)
        headers: { 'X-Title': 'lmuse' },
      })(model),
    nvidia: async () =>
      createOpenAICompatible({
        name: 'nvidia',
        apiKey,
        baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
      })(model),
    opencode: async () =>
      createOpenAICompatible({
        name: 'opencode',
        apiKey,
        baseURL: baseUrl || 'https://opencode.ai/zen/v1',
        headers: { 'X-Title': 'lmuse' },
      })(model),
    github: async () =>
      createOpenAICompatible({
        name: 'github',
        apiKey,
        baseURL: baseUrl || 'https://models.github.ai/inference',
      })(model),
    baseten: async () =>
      createOpenAICompatible({
        name: 'baseten',
        apiKey,
        baseURL: baseUrl || 'https://inference.baseten.co/v1',
      })(model),
    sambanova: async () =>
      createOpenAICompatible({
        name: 'sambanova',
        apiKey,
        baseURL: baseUrl || 'https://api.sambanova.ai/v1',
      })(model),
    ollama: async () =>
      createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
        apiKey: apiKey || 'ollama',
      })(model),
    lmstudio: async () =>
      createOpenAICompatible({
        name: 'lmstudio',
        baseURL: baseUrl || 'http://localhost:1234/v1',
        apiKey: apiKey || 'lm-studio',
      })(model),
    custom: async () => {
      if (!baseUrl) throw new Error('Il provider custom richiede il base URL.');
      return createOpenAICompatible({
        name: 'custom',
        apiKey: apiKey || undefined,
        baseURL: baseUrl,
      })(model);
    },
  };

  const factory = factories[providerId];
  if (!factory) throw new Error(`Provider non supportato: ${providerId}`);
  return factory();
}
