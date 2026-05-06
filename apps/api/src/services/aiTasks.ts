import OpenAI from 'openai';

const FALLBACK_MODEL = 'gpt-4o-mini';

export async function generateTitle(opts: {
  apiKey: string;
  userMessage: string;
  assistantReply: string;
}): Promise<string | null> {
  if (!opts.apiKey) return null;
  try {
    const client = new OpenAI({ apiKey: opts.apiKey });
    const res = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Você gera títulos curtos (3-6 palavras) em português brasileiro para conversas. Responda APENAS com o título, sem aspas, sem pontuação final.',
        },
        {
          role: 'user',
          content: `Usuário: ${opts.userMessage.slice(0, 600)}\n\nAssistente: ${opts.assistantReply.slice(0, 600)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 30,
    });
    const title = res.choices[0]?.message?.content?.trim();
    if (!title) return null;
    return title.replace(/^["'`]|["'`.,:!?]+$/g, '').slice(0, 80);
  } catch {
    return null;
  }
}

export interface ExtractedMemory {
  content: string;
  category?: string;
}

export async function extractMemories(opts: {
  apiKey: string;
  userMessage: string;
  assistantReply: string;
  existingMemories: string[];
}): Promise<ExtractedMemory[]> {
  if (!opts.apiKey) return [];
  try {
    const client = new OpenAI({ apiKey: opts.apiKey });
    const existingBlock = opts.existingMemories.length
      ? `\n\nMemórias já existentes (NÃO duplique):\n${opts.existingMemories
          .slice(0, 50)
          .map((m) => `- ${m}`)
          .join('\n')}`
      : '';
    const res = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: [
        {
          role: 'system',
          content: `Você é um sistema de extração de memórias de longo prazo sobre o usuário.
REGRAS RÍGIDAS:
- Identifique APENAS fatos novos e duradouros sobre o USUÁRIO (papel, projetos atuais, ferramentas que usa, preferências, restrições, equipe, clientes/parceiros mencionados, gostos pessoais).
- NUNCA invente. Se não há fato claro novo, retorne lista vazia.
- Não salve perguntas, pedidos pontuais, ou estados temporários.
- Cada fato deve ser uma frase curta autoexplicativa (ex: "Trabalha com Next.js no Coolify").
- Categoria sugerida: trabalho, ferramentas, preferencias, projetos, pessoal, restricoes.
- Não duplique memórias existentes.
Responda APENAS JSON válido no formato {"memories": [{"content":"...", "category":"..."}]}. Se nada novo, {"memories":[]}.`,
        },
        {
          role: 'user',
          content: `Usuário: ${opts.userMessage.slice(0, 1500)}\n\nAssistente: ${opts.assistantReply.slice(0, 1500)}${existingBlock}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 400,
    });
    const json = res.choices[0]?.message?.content;
    if (!json) return [];
    const parsed = JSON.parse(json);
    const memories = parsed.memories;
    if (!Array.isArray(memories)) return [];
    return memories
      .filter((m: any) => m && typeof m.content === 'string' && m.content.length > 5)
      .map((m: any) => ({
        content: m.content.trim().slice(0, 300),
        category: typeof m.category === 'string' ? m.category.trim().slice(0, 30) : undefined,
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
}
