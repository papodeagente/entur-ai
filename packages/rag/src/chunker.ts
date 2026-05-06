/**
 * Splits text into overlapping chunks of ~maxChars characters,
 * preferring paragraph and sentence boundaries.
 */
export function chunkText(
  text: string,
  opts: { maxChars?: number; overlap?: number } = {}
): string[] {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = opts.overlap ?? 150;

  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Split por parágrafo
  const paragraphs = normalized.split(/\n\s*\n/).filter((p) => p.trim());

  const chunks: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= maxChars) {
      buffer = buffer ? buffer + '\n\n' + para : para;
      continue;
    }
    // flush buffer
    if (buffer) {
      chunks.push(buffer.trim());
      buffer = '';
    }
    // se o parágrafo é maior que maxChars, split por frase
    if (para.length > maxChars) {
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sub = '';
      for (const s of sentences) {
        if ((sub + ' ' + s).length <= maxChars) {
          sub = sub ? sub + ' ' + s : s;
        } else {
          if (sub) chunks.push(sub.trim());
          if (s.length > maxChars) {
            // hard chunk
            for (let i = 0; i < s.length; i += maxChars - overlap) {
              chunks.push(s.slice(i, i + maxChars));
            }
            sub = '';
          } else {
            sub = s;
          }
        }
      }
      if (sub) chunks.push(sub.trim());
    } else {
      buffer = para;
    }
  }
  if (buffer) chunks.push(buffer.trim());

  // Aplica overlap entre chunks consecutivos
  if (overlap > 0 && chunks.length > 1) {
    return chunks.map((c, i) => {
      if (i === 0) return c;
      const prev = chunks[i - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      return tail + ' ' + c;
    });
  }
  return chunks;
}

export function approxTokens(text: string): number {
  // heurística: ~4 chars por token
  return Math.ceil(text.length / 4);
}
