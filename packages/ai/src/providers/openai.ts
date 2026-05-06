import OpenAI from 'openai';
import type { StreamArgs, StreamEvent } from '../types';

export async function* streamOpenAI({
  modelId,
  messages,
  apiKey,
}: StreamArgs): AsyncGenerator<StreamEvent> {
  const client = new OpenAI({ apiKey });
  const isReasoning = modelId.startsWith('o3') || modelId.startsWith('o4');

  const oaiMessages = messages.map((m) => {
    if (!m.attachments?.length || m.role !== 'user') {
      return { role: m.role, content: m.content };
    }
    const parts: any[] = [{ type: 'text', text: m.content || '' }];
    for (const a of m.attachments) {
      if (a.kind === 'image') {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${a.mimeType};base64,${a.data}` },
        });
      } else if (a.kind === 'pdf') {
        parts.push({
          type: 'file',
          file: {
            filename: a.name || 'doc.pdf',
            file_data: `data:${a.mimeType};base64,${a.data}`,
          },
        });
      } else if (a.kind === 'text') {
        parts.push({ type: 'text', text: `--- ${a.name || 'arquivo'} ---\n${a.data}` });
      }
    }
    return { role: 'user', content: parts };
  });

  const stream = await client.chat.completions.create({
    model: modelId,
    messages: oaiMessages as any,
    stream: true,
    ...(isReasoning ? { reasoning_effort: 'medium' as any } : {}),
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield { type: 'delta', text: delta };
  }
}

export async function generateOpenAIImage(opts: {
  modelId: string;
  prompt: string;
  apiKey: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<{ b64: string; mimeType: string }> {
  const client = new OpenAI({ apiKey: opts.apiKey });

  if (opts.imageBase64) {
    const buffer = Buffer.from(opts.imageBase64, 'base64');
    const file = await OpenAI.toFile(buffer, 'input.png', {
      type: opts.imageMime || 'image/png',
    });
    const result = await client.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: opts.prompt,
      size: '1024x1024',
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI não retornou imagem editada');
    return { b64, mimeType: 'image/png' };
  }

  const params: any = {
    model: opts.modelId,
    prompt: opts.prompt,
    size: '1024x1024',
    n: 1,
  };
  if (opts.modelId === 'gpt-image-1') {
    params.quality = 'high';
  } else if (opts.modelId === 'dall-e-3') {
    params.quality = 'hd';
    params.response_format = 'b64_json';
  }
  const result = await client.images.generate(params);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI não retornou imagem');
  return { b64, mimeType: 'image/png' };
}
