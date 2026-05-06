import type { Provider, Capability, ModelKind } from './types';

export interface ModelDef {
  id: string;
  label: string;
  provider: Provider;
  kind: ModelKind;
  description: string;
  capabilities: Capability[];
  imageEndpoint?: 'openai-images' | 'gemini-imagen';
  requiresBilling?: boolean;
  default?: boolean;
}

export const MODELS: ModelDef[] = [
  // ===== OpenAI · Chat =====
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    kind: 'chat',
    description: 'OpenAI flagship multimodal — vision + texto',
    capabilities: ['text', 'vision', 'pdf'],
    default: true,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    kind: 'chat',
    description: 'Rápido e econômico com vision',
    capabilities: ['text', 'vision'],
  },
  {
    id: 'o3',
    label: 'o3 (reasoning)',
    provider: 'openai',
    kind: 'chat',
    description: 'Reasoning de ponta',
    capabilities: ['text', 'vision', 'reasoning'],
  },
  {
    id: 'o4-mini',
    label: 'o4-mini',
    provider: 'openai',
    kind: 'chat',
    description: 'Reasoning rápido e econômico',
    capabilities: ['text', 'vision', 'reasoning'],
  },

  // ===== OpenAI · Imagem =====
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    provider: 'openai',
    kind: 'image',
    description: 'OpenAI imagem premium (geração + edição)',
    capabilities: ['image-gen', 'image-edit'],
    imageEndpoint: 'openai-images',
  },
  {
    id: 'dall-e-3',
    label: 'DALL-E 3',
    provider: 'openai',
    kind: 'image',
    description: 'Imagens criativas, foco artístico',
    capabilities: ['image-gen'],
    imageEndpoint: 'openai-images',
  },

  // ===== Anthropic =====
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    kind: 'chat',
    description: 'Anthropic máximo — thinking, web search, code',
    capabilities: ['text', 'vision', 'pdf', 'thinking', 'web-search', 'code-exec'],
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    kind: 'chat',
    description: 'Equilibrado — thinking, web search, code',
    capabilities: ['text', 'vision', 'pdf', 'thinking', 'web-search', 'code-exec'],
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    kind: 'chat',
    description: 'Rápido com tools',
    capabilities: ['text', 'vision', 'pdf', 'web-search', 'code-exec'],
  },

  // ===== Google =====
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    kind: 'chat',
    description: 'Rápido com thinking — free tier OK',
    capabilities: ['text', 'vision', 'pdf', 'thinking', 'web-search', 'code-exec'],
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    kind: 'chat',
    description: 'Multimodal nativo — free tier OK',
    capabilities: ['text', 'vision', 'pdf', 'web-search', 'code-exec'],
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'gemini',
    kind: 'chat',
    description: 'Contexto longo (2M) — free tier',
    capabilities: ['text', 'vision', 'pdf', 'web-search', 'code-exec'],
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    kind: 'chat',
    description: 'Flagship Google — exige billing ativo',
    capabilities: ['text', 'vision', 'pdf', 'thinking', 'web-search', 'code-exec'],
    requiresBilling: true,
  },
  {
    id: 'imagen-3.0-generate-002',
    label: 'Imagen 3',
    provider: 'gemini',
    kind: 'image',
    description: 'Google fotorrealismo — exige billing',
    capabilities: ['image-gen'],
    imageEndpoint: 'gemini-imagen',
    requiresBilling: true,
  },
];

export const DEFAULT_MODEL_ID = 'gpt-4o';

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelHas(id: string, cap: Capability): boolean {
  return getModel(id)?.capabilities.includes(cap) ?? false;
}

export function isImageModel(id: string): boolean {
  return getModel(id)?.kind === 'image';
}
