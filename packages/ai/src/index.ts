import { streamOpenAI } from './providers/openai';
import { streamAnthropic } from './providers/anthropic';
import { streamGemini } from './providers/gemini';
import { getModel } from './models';
import type { ChatMessage, Provider } from './types';

export * from './types';
export * from './models';

export async function* streamChat(args: {
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
}): AsyncGenerator<string> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Modelo desconhecido: ${args.modelId}`);

  if (model.provider === 'openai') yield* streamOpenAI(args);
  else if (model.provider === 'anthropic') yield* streamAnthropic(args);
  else if (model.provider === 'gemini') yield* streamGemini(args);
  else throw new Error(`Provider desconhecido: ${model.provider}`);
}

export function humanizeProviderError(
  err: unknown,
  provider: Provider,
  modelId: string
): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (provider === 'gemini') {
    if (lower.includes('429') || lower.includes('quota')) {
      return `Quota Gemini estourada para ${modelId}. Aguarde alguns minutos ou troque para outro modelo.`;
    }
    if (lower.includes('401') || lower.includes('api key')) {
      return 'Chave Gemini inválida. Atualize em Configurações > Chaves de IA.';
    }
  }
  if (provider === 'openai') {
    if (lower.includes('insufficient_quota') || lower.includes('429')) {
      return 'Sem créditos OpenAI ou rate limit. Verifique billing.';
    }
    if (lower.includes('401') || lower.includes('invalid_api_key')) {
      return 'Chave OpenAI inválida. Atualize em Configurações > Chaves de IA.';
    }
    if (lower.includes('model_not_found')) {
      return `Modelo "${modelId}" indisponível na sua conta. Tente GPT-4o ou GPT-4o mini.`;
    }
  }
  if (provider === 'anthropic') {
    if (lower.includes('429')) return 'Rate limit Anthropic. Aguarde alguns segundos.';
    if (lower.includes('401') || lower.includes('authentication'))
      return 'Chave Anthropic inválida. Atualize em Configurações > Chaves de IA.';
  }
  return raw.length > 600 ? raw.slice(0, 600) + '…' : raw;
}
