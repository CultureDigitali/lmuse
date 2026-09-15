import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createGroq } from '@ai-sdk/groq';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createCerebras } from '@ai-sdk/cerebras';
import { createMistral } from '@ai-sdk/mistral';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { Settings } from '../shared/settings';

/**
 * Crea il modello AI SDK v7 corrispondente alle impostazioni utente.
 * Ogni provider ufficiale ha il suo package; tutto ciò che è
 * OpenAI-compatibile (OpenRouter, Ollama, LM Studio, custom) passa
 * da createOpenAICompatible con baseURL configurabile.
 * La chiave non vive nelle settings: arriva come parametro dedicato.
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
