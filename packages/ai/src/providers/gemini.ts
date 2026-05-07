import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StreamArgs, StreamEvent } from '../types';

export async function* streamGemini({
  modelId,
  messages,
  apiKey,
  tools,
}: StreamArgs): AsyncGenerator<StreamEvent> {
  const client = new GoogleGenerativeAI(apiKey);
  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const conv = messages.filter((m) => m.role !== 'system');

  const lastUser = conv[conv.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    throw new Error('Última mensagem deve ser do usuário');
  }

  const toGemParts = (msg: any): any[] => {
    const parts: any[] = [];
    if (msg.attachments?.length) {
      for (const a of msg.attachments) {
        parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
      }
    }
    if (msg.content) parts.push({ text: msg.content });
    return parts;
  };

  const history = conv.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: toGemParts(m),
  }));

  const apiTools: any[] = [];
  if (tools?.webSearch) apiTools.push({ googleSearch: {} });
  if (tools?.codeExec) apiTools.push({ codeExecution: {} });

  const generative = client.getGenerativeModel({
    model: modelId,
    systemInstruction: systemMsg,
    ...(apiTools.length ? { tools: apiTools } : {}),
  } as any);

  const chat = generative.startChat({ history });
  const result = await chat.sendMessageStream(toGemParts(lastUser));

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield { type: 'delta', text };

    const cand = chunk.candidates?.[0];
    const parts = cand?.content?.parts;
    if (parts) {
      for (const p of parts as any[]) {
        if (p.inlineData) {
          yield {
            type: 'image',
            mimeType: p.inlineData.mimeType || 'image/png',
            b64: p.inlineData.data,
          };
        }
        if (p.executableCode) {
          yield { type: 'tool_start', tool: 'code_execution', input: p.executableCode.code };
        }
        if (p.codeExecutionResult) {
          yield {
            type: 'tool_result',
            tool: 'code_execution',
            output: p.codeExecutionResult.output,
          };
        }
      }
    }
  }

  // Citations from grounding metadata
  try {
    const final = await result.response;
    const grounding = (final as any).candidates?.[0]?.groundingMetadata;
    if (grounding?.groundingChunks) {
      for (const c of grounding.groundingChunks) {
        if (c.web?.uri) yield { type: 'citation', url: c.web.uri, title: c.web.title };
      }
    }
  } catch {}
}

export async function generateImagen(opts: {
  modelId: string;
  prompt: string;
  apiKey: string;
}): Promise<{ b64: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.modelId
  )}:predict?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1', safetyFilterLevel: 'block_some' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Imagen API erro ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as any;
  const pred = data?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen não retornou imagem');
  return { b64, mimeType: pred.mimeType || 'image/png' };
}

/**
 * Gera/edita imagem via Gemini 2.5 Flash Image (generateContent com responseModalities=IMAGE).
 * Funciona em tiers padrão da Gemini API; aceita imagem como input para edição.
 */
export async function generateGeminiFlashImage(opts: {
  modelId: string;
  prompt: string;
  apiKey: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<{ b64: string; mimeType: string }> {
  const parts: any[] = [];
  if (opts.imageBase64) {
    parts.push({
      inlineData: { mimeType: opts.imageMime || 'image/png', data: opts.imageBase64 },
    });
  }
  parts.push({ text: opts.prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.modelId
  )}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Image API erro ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as any;
  const candidates = data?.candidates ?? [];
  for (const cand of candidates) {
    const cParts = cand?.content?.parts ?? [];
    for (const p of cParts) {
      if (p?.inlineData?.data) {
        return {
          b64: p.inlineData.data,
          mimeType: p.inlineData.mimeType || 'image/png',
        };
      }
    }
  }
  throw new Error('Gemini não retornou imagem (resposta sem inline_data)');
}
