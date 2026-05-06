import Anthropic from '@anthropic-ai/sdk';
import type { StreamArgs, StreamEvent } from '../types';

export async function* streamAnthropic({
  modelId,
  messages,
  apiKey,
  tools,
}: StreamArgs): AsyncGenerator<StreamEvent> {
  const client = new Anthropic({ apiKey });
  const system = messages.find((m) => m.role === 'system')?.content;
  const conv = messages.filter((m) => m.role !== 'system');

  const anthroMessages: any[] = conv.map((m) => {
    if (!m.attachments?.length || m.role !== 'user') {
      return { role: m.role, content: m.content };
    }
    const blocks: any[] = [];
    for (const a of m.attachments) {
      if (a.kind === 'image') {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: a.mimeType, data: a.data },
        });
      } else if (a.kind === 'pdf') {
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: a.data },
        });
      } else if (a.kind === 'text') {
        blocks.push({ type: 'text', text: `--- ${a.name || 'arquivo'} ---\n${a.data}` });
      }
    }
    if (m.content) blocks.push({ type: 'text', text: m.content });
    return { role: m.role, content: blocks };
  });

  const apiTools: any[] = [];
  if (tools?.webSearch) {
    apiTools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 });
  }
  if (tools?.codeExec) {
    apiTools.push({ type: 'code_execution_20250522', name: 'code_execution' });
  }

  const params: any = {
    model: modelId,
    max_tokens: 8192,
    system,
    messages: anthroMessages,
  };
  if (apiTools.length) params.tools = apiTools;
  if (tools?.thinking) {
    params.thinking = { type: 'enabled', budget_tokens: 5000 };
    params.max_tokens = 16000;
  }

  const stream = await client.messages.stream(params);

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      const block = event.content_block as any;
      if (block.type === 'tool_use' || block.type === 'server_tool_use') {
        yield { type: 'tool_start', tool: block.name };
      }
    } else if (event.type === 'content_block_delta') {
      const delta: any = event.delta;
      if (delta.type === 'text_delta') {
        yield { type: 'delta', text: delta.text };
      } else if (delta.type === 'thinking_delta') {
        yield { type: 'thinking', text: delta.thinking };
      }
    }
  }

  // Citations from web_search results no final
  try {
    const final = await stream.finalMessage();
    for (const block of final.content) {
      if ((block as any).type === 'web_search_tool_result') {
        const results = (block as any).content;
        if (Array.isArray(results)) {
          for (const r of results) {
            if (r.type === 'web_search_result') {
              yield { type: 'citation', url: r.url, title: r.title };
            }
          }
        }
      }
    }
  } catch {}
}
