import type { Provider } from './types';

export interface ModelDef {
  id: string;
  label: string;
  provider: Provider;
  description: string;
  default?: boolean;
}

export const MODELS: ModelDef[] = [
  // OpenAI
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    description: 'OpenAI flagship multimodal',
    default: true,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    description: 'Rápido e econômico',
  },
  {
    id: 'o4-mini',
    label: 'o4-mini',
    provider: 'openai',
    description: 'Reasoning rápido',
  },

  // Anthropic
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Equilibrado e poderoso',
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    description: 'Máxima capacidade',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Rápido e leve',
  },

  // Google
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Google rápido — free tier OK',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Google multimodal — free tier OK',
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Contexto longo (2M tokens) — free tier',
  },
];

export const DEFAULT_MODEL_ID = 'gpt-4o';

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByProvider(): Record<Provider, ModelDef[]> {
  const out: Record<Provider, ModelDef[]> = { openai: [], anthropic: [], gemini: [] };
  for (const m of MODELS) out[m.provider].push(m);
  return out;
}
