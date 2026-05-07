/**
 * Tabela de pricing aproximado, em USD por 1M tokens (input/output).
 * Para imagem, valor por imagem em USD.
 * Fonte: tabelas públicas dos providers (atualizar trimestralmente).
 */

interface ChatPricing {
  input: number; // USD per 1M tokens
  output: number;
}

interface ImagePricing {
  perImage: number; // USD por imagem 1024x1024
}

export const CHAT_PRICING: Record<string, ChatPricing> = {
  // OpenAI - Chat
  'gpt-5': { input: 8, output: 24 },
  'gpt-5-mini': { input: 0.5, output: 1.5 },
  'gpt-4.1': { input: 3, output: 12 },
  'gpt-4o': { input: 5, output: 20 },
  'gpt-4o-mini': { input: 0.6, output: 2.4 },
  // OpenAI - Reasoning
  'o3-pro': { input: 30, output: 120 },
  o3: { input: 20, output: 80 },
  'o4-mini': { input: 1.1, output: 4.4 },

  // Anthropic
  'claude-opus-4-7': { input: 20, output: 100 },
  'claude-sonnet-4-6': { input: 5, output: 25 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },

  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

export const IMAGE_PRICING: Record<string, ImagePricing> = {
  'gpt-image-1': { perImage: 0.19 }, // quality high
  'dall-e-3': { perImage: 0.08 }, // hd 1024
  'imagen-3.0-generate-002': { perImage: 0.03 },
};

/** Estimativa simples de tokens: ~4 chars/token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4));
}

export function chatCostCents(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = CHAT_PRICING[modelId];
  if (!p) return 0;
  const usd =
    (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
  return Math.ceil(usd * 100); // cents (round up)
}

export function imageCostCents(modelId: string): number {
  const p = IMAGE_PRICING[modelId];
  if (!p) return 0;
  return Math.ceil(p.perImage * 100);
}
