export type Provider = 'openai' | 'anthropic' | 'gemini';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamArgs {
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export class MissingKeyError extends Error {
  provider: Provider;
  constructor(provider: Provider) {
    super(`Chave de API "${provider}" não configurada. Acesse Configurações > Chaves de IA.`);
    this.provider = provider;
    this.name = 'MissingKeyError';
  }
}
