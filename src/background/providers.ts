import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createGroq } from '@ai-sdk/groq';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createCerebras } from '@ai-sdk/cerebras';
import { createMistral } from '@ai-sdk/mistral';
import { createAzure } from '@ai-sdk/azure';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createFireworks } from '@ai-sdk/fireworks';
import { createPerplexity } from '@ai-sdk/perplexity';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { createGateway } from '@ai-sdk/gateway';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { Settings } from '../shared/settings';

/**
 * Crea il modello AI SDK v7 corrispondente alle impostazioni utente.
 * Provider con package dedicato: createXxx({ apiKey })(model).
 * Provider OpenAI-compatibili (OpenRouter, NVIDIA, OpenCode Zen, GitHub,
 * Baseten, SambaNova, Ollama, LM Studio, custom): createOpenAICompatible
 * con baseURL configurabile. La chiave non vive nelle settings:
 * arriva come parametro dedicato.
 */
export function createModel(settings: Settings, apiKey: string): LanguageModel {
  const { providerId, model, baseUrl } = settings;
  if (!model) throw new Error('Specifica il nome del modello nelle impostazioni.');

  switch (providerId) {
    case 'openai':
      return createOpenAI({ apiKey })(model);
    case 'anthropic':
      return createAnthropic({ apiKey })(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model);
    case 'xai':
      return createXai({ apiKey })(model);
    case 'groq':
      return createGroq({ apiKey })(model);
    case 'deepseek':
      return createDeepSeek({ apiKey })(model);
    case 'cerebras':
      return createCerebras({ apiKey })(model);
    case 'mistral':
      return createMistral({ apiKey })(model);
    case 'cohere':
      return createCohere({ apiKey })(model);
    case 'deepinfra':
      return createDeepInfra({ apiKey })(model);
    case 'fireworks':
      return createFireworks({ apiKey })(model);
    case 'perplexity':
      return createPerplexity({ apiKey })(model);
    case 'togetherai':
      return createTogetherAI({ apiKey })(model);
    case 'huggingface':
      return createHuggingFace({ apiKey })(model);
    case 'gateway':
      return createGateway({ apiKey })(model);
    case 'azure':
      if (!baseUrl) throw new Error('Azure OpenAI richiede il base URL (endpoint risorsa).');
      return createAzure({ apiKey, baseURL: baseUrl })(model);
    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL: baseUrl || 'https://openrouter.ai/api/v1',
        // Nessun referer falso: solo il nome del prodotto. (P28)
        headers: { 'X-Title': 'lmuse' },
      })(model);
    case 'nvidia':
      return createOpenAICompatible({
        name: 'nvidia',
        apiKey,
        baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
      })(model);
    case 'opencode':
      return createOpenAICompatible({
        name: 'opencode',
        apiKey,
        baseURL: baseUrl || 'https://opencode.ai/zen/v1',
        headers: { 'X-Title': 'lmuse' },
      })(model);
    case 'github':
      return createOpenAICompatible({
        name: 'github',
        apiKey,
        baseURL: baseUrl || 'https://models.github.ai/inference',
      })(model);
    case 'baseten':
      return createOpenAICompatible({
        name: 'baseten',
        apiKey,
        baseURL: baseUrl || 'https://inference.baseten.co/v1',
      })(model);
    case 'sambanova':
      return createOpenAICompatible({
        name: 'sambanova',
        apiKey,
        baseURL: baseUrl || 'https://api.sambanova.ai/v1',
      })(model);
    case 'ollama':
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
        apiKey: apiKey || 'ollama',
      })(model);
    case 'lmstudio':
      return createOpenAICompatible({
        name: 'lmstudio',
        baseURL: baseUrl || 'http://localhost:1234/v1',
        apiKey: apiKey || 'lm-studio',
      })(model);
    case 'custom':
      if (!baseUrl) throw new Error('Il provider custom richiede il base URL.');
      return createOpenAICompatible({
        name: 'custom',
        apiKey: apiKey || undefined,
        baseURL: baseUrl,
      })(model);
    default:
      throw new Error(`Provider non supportato: ${providerId}`);
  }
}
