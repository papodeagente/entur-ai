import OpenAI from 'openai';
import type { StreamArgs } from '../types';

export async function* streamOpenAI({
  modelId,
  messages,
  apiKey,
}: StreamArgs): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey });
  const isReasoning = modelId.startsWith('o3') || modelId.startsWith('o4');

  const stream = await client.chat.completions.create({
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    ...(isReasoning ? { reasoning_effort: 'medium' as any } : {}),
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
