export type Provider = 'openai' | 'anthropic' | 'gemini';

export type ImageEndpoint = 'openai-images' | 'gemini-imagen' | 'gemini-flash-image';

export type Capability =
  | 'text'
  | 'vision'
  | 'pdf'
  | 'image-gen'
  | 'image-edit'
  | 'web-search'
  | 'code-exec'
  | 'thinking'
  | 'reasoning';

export type ModelKind = 'chat' | 'image';

export interface Attachment {
  kind: 'image' | 'pdf' | 'text';
  mimeType: string;
  data: string; // base64 (sem prefixo data:)
  name?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
}

export interface ToolFlags {
  webSearch?: boolean;
  codeExec?: boolean;
  thinking?: boolean;
}

export interface StreamArgs {
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
  tools?: ToolFlags;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'image'; mimeType: string; b64: string; alt?: string }
  | { type: 'citation'; url: string; title?: string; snippet?: string }
  | { type: 'tool_start'; tool: string; input?: unknown }
  | { type: 'tool_result'; tool: string; output?: string };

export class MissingKeyError extends Error {
  provider: Provider;
  constructor(provider: Provider) {
    super(`Chave de API "${provider}" não configurada. Acesse Configurações > Chaves de IA.`);
    this.provider = provider;
    this.name = 'MissingKeyError';
  }
}
