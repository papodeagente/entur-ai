import { streamOpenAI, generateOpenAIImage } from './providers/openai';
import { streamAnthropic } from './providers/anthropic';
import { streamGemini, generateImagen } from './providers/gemini';
import { getModel, isImageModel } from './models';
import type { ChatMessage, Provider, StreamArgs, StreamEvent, ToolFlags } from './types';

export * from './types';
export * from './models';
export * from './pricing';

export async function* streamChat(
  args: StreamArgs
): AsyncGenerator<StreamEvent> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Modelo desconhecido: ${args.modelId}`);

  if (model.provider === 'openai') yield* streamOpenAI(args);
  else if (model.provider === 'anthropic') yield* streamAnthropic(args);
  else if (model.provider === 'gemini') yield* streamGemini(args);
  else throw new Error(`Provider desconhecido: ${model.provider}`);
}

export async function generateImage(args: {
  modelId: string;
  prompt: string;
  apiKey: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<{ b64: string; mimeType: string }> {
  const m = getModel(args.modelId);
  if (!m) throw new Error('Modelo desconhecido');
  if (m.imageEndpoint === 'openai-images') {
    return generateOpenAIImage(args);
  }
  if (m.imageEndpoint === 'gemini-imagen') {
    return generateImagen({ prompt: args.prompt, apiKey: args.apiKey });
  }
  throw new Error(`Modelo ${args.modelId} não suporta geração de imagem`);
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
      if (modelId === 'gemini-2.5-pro' || modelId === 'imagen-3.0-generate-002') {
        return `O modelo ${modelId} exige uma conta Google AI com billing ativo. Sua chave atual está no free tier.\nTroque para Gemini 2.5/2.0 Flash ou 1.5 Pro, ou ative billing em aistudio.google.com/apikey.`;
      }
      return `Quota Gemini estourada para ${modelId}. Aguarde alguns minutos ou troque para outro modelo.`;
    }
    if (lower.includes('401') || lower.includes('api key')) {
      return 'Chave Gemini inválida. Atualize em Configurações > Chaves de IA.';
    }
    if (lower.includes('safety') || lower.includes('blocked')) {
      return 'Gemini bloqueou a resposta por filtro de segurança. Reformule.';
    }
  }
  if (provider === 'openai') {
    if (lower.includes('insufficient_quota') || lower.includes('429')) {
      return 'Sem créditos OpenAI ou rate limit. Verifique billing.';
    }
    if (lower.includes('401') || lower.includes('invalid_api_key')) {
      return 'Chave OpenAI inválida. Atualize em Configurações > Chaves de IA.';
    }
    if (lower.includes('model_not_found') || lower.includes('does not exist')) {
      return `Modelo "${modelId}" indisponível na sua conta OpenAI. Tente GPT-4o ou GPT-4o mini.`;
    }
  }
  if (provider === 'anthropic') {
    if (lower.includes('429')) return 'Rate limit Anthropic. Aguarde alguns segundos.';
    if (lower.includes('401') || lower.includes('authentication'))
      return 'Chave Anthropic inválida. Atualize em Configurações > Chaves de IA.';
  }
  return raw.length > 600 ? raw.slice(0, 600) + '…' : raw;
}

export { isImageModel };
