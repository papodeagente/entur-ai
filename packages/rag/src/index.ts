import { db, schema } from '@entur-ai/db';
import { eq, sql, and } from 'drizzle-orm';
import { chunkText, approxTokens } from './chunker';
import { embedText, embedBatch, EMBED_DIMENSIONS } from './embedder';

export { chunkText, embedText, embedBatch, EMBED_DIMENSIONS };

export interface IndexResult {
  documentId: string;
  chunksCreated: number;
}

export async function indexDocument(args: {
  tenantId: string;
  title: string;
  content: string;
  category?: string;
  sourceUrl?: string;
  sourceType?: 'upload' | 'drive' | 'notion' | 'manual' | 'url';
  apiKey: string;
}): Promise<IndexResult> {
  const chunks = chunkText(args.content, { maxChars: 1200, overlap: 150 });
  if (chunks.length === 0) throw new Error('Documento vazio');

  // Cria documento
  const [doc] = await db
    .insert(schema.kbDocument)
    .values({
      tenantId: args.tenantId,
      title: args.title,
      sourceUrl: args.sourceUrl ?? null,
      sourceType: args.sourceType ?? 'manual',
      category: args.category ?? null,
      totalChunks: chunks.length,
      indexedAt: new Date(),
    })
    .returning();

  // Embeddings em batch
  const embeddings = await embedBatch(chunks, args.apiKey);

  // Insere chunks
  const rows = chunks.map((content, i) => ({
    documentId: doc.id,
    tenantId: args.tenantId,
    chunkIndex: i,
    content,
    embedding: embeddings[i],
    tokens: approxTokens(content),
  }));

  // Insert em lote (drizzle não suporta vector array nativo, então vou fazer um por um com SQL raw)
  for (const row of rows) {
    const vec = `[${row.embedding!.join(',')}]`;
    await db.execute(sql`
      INSERT INTO kb_chunk (document_id, tenant_id, chunk_index, content, embedding, tokens)
      VALUES (${row.documentId}, ${row.tenantId}, ${row.chunkIndex}, ${row.content}, ${vec}::vector, ${row.tokens})
    `);
  }

  return { documentId: doc.id, chunksCreated: chunks.length };
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentCategory: string | null;
  content: string;
  distance: number;
}

export async function retrieve(args: {
  tenantId: string;
  query: string;
  apiKey: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<RetrievedChunk[]> {
  const topK = args.topK ?? 5;
  const minSimilarity = args.minSimilarity ?? 0.35;

  const queryEmbed = await embedText(args.query, args.apiKey);
  const vec = `[${queryEmbed.join(',')}]`;

  // cosine distance (1 - cosine similarity). Menor é melhor.
  const result = await db.execute(sql`
    SELECT
      c.id::text as chunk_id,
      c.document_id::text as document_id,
      d.title as document_title,
      d.category as document_category,
      c.content,
      (c.embedding <=> ${vec}::vector) as distance
    FROM kb_chunk c
    JOIN kb_document d ON d.id = c.document_id
    WHERE c.tenant_id = ${args.tenantId}
    ORDER BY c.embedding <=> ${vec}::vector ASC
    LIMIT ${topK}
  `);

  const rows = (result as any).rows ?? result;

  return (rows as any[])
    .map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      documentCategory: r.document_category,
      content: r.content,
      distance: parseFloat(r.distance),
    }))
    .filter((r) => 1 - r.distance >= minSimilarity);
}

export async function deleteDocument(tenantId: string, documentId: string): Promise<void> {
  await db
    .delete(schema.kbDocument)
    .where(and(eq(schema.kbDocument.id, documentId), eq(schema.kbDocument.tenantId, tenantId)));
  // chunks são apagados via ON DELETE CASCADE
}

export async function listDocuments(tenantId: string) {
  return await db
    .select({
      id: schema.kbDocument.id,
      title: schema.kbDocument.title,
      category: schema.kbDocument.category,
      sourceType: schema.kbDocument.sourceType,
      totalChunks: schema.kbDocument.totalChunks,
      indexedAt: schema.kbDocument.indexedAt,
      createdAt: schema.kbDocument.createdAt,
    })
    .from(schema.kbDocument)
    .where(eq(schema.kbDocument.tenantId, tenantId))
    .orderBy(schema.kbDocument.createdAt);
}
