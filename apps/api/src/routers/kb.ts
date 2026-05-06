import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { indexDocument, listDocuments, deleteDocument } from '@entur-ai/rag';
import { getApiKey } from '../services/settings';

export const kbRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return await listDocuments(ctx.tenantId);
  }),

  upload: adminProcedure
    .input(
      z.object({
        title: z.string().min(2).max(300),
        content: z.string().min(20),
        category: z.string().max(80).optional(),
        sourceUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getApiKey('openai');
      if (!apiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Chave OpenAI necessária para indexação. Cadastre em Configurações > Chaves de IA.',
        });
      }
      const result = await indexDocument({
        tenantId: ctx.tenantId,
        title: input.title,
        content: input.content,
        category: input.category,
        sourceUrl: input.sourceUrl,
        sourceType: 'manual',
        apiKey,
      });
      return result;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDocument(ctx.tenantId, input.id);
      return { ok: true };
    }),
});
