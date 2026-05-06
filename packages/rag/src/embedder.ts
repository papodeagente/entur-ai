import OpenAI from 'openai';

const EMBED_MODEL = 'text-embedding-3-small';
export const EMBED_DIMENSIONS = 1536;

export async function embedText(text: string, apiKey: string): Promise<number[]> {
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
