import Anthropic from '@anthropic-ai/sdk';
import type { StreamArgs } from '../types';

export async function* streamAnthropic({
  modelId,
  messages,
  apiKey,
}: StreamArgs): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const system = messages.find((m) => m.role === 'system')?.content;
  const conv = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const stream = await client.messages.stream({
    model: modelId,
    max_tokens: 4096,
    system,
    messages: conv,
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
