import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StreamArgs } from '../types';

export async function* streamGemini({
  modelId,
  messages,
  apiKey,
}: StreamArgs): AsyncGenerator<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const conv = messages.filter((m) => m.role !== 'system');

  const lastUser = conv[conv.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    throw new Error('Última mensagem deve ser do usuário');
  }

  const history = conv.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const generative = client.getGenerativeModel({
    model: modelId,
    systemInstruction: systemMsg,
  });
  const chat = generative.startChat({ history });
  const result = await chat.sendMessageStream(lastUser.content);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
