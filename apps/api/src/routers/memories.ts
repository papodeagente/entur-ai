import { z } from 'zod';
import { router, tenantProcedure } from '../trpc';
import { db, schema } from '@entur-ai/db';
import { and, desc, eq } from 'drizzle-orm';

export const memoriesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(schema.userMemory)
      .where(
        and(
          eq(schema.userMemory.tenantId, ctx.tenantId),
          eq(schema.userMemory.userId, ctx.userId)
        )
      )
      .orderBy(desc(schema.userMemory.updatedAt))
      .limit(200);
  }),

  create: tenantProcedure
    .input(z.object({ content: z.string().min(3).max(500), category: z.string().max(30).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(schema.userMemory)
        .values({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          content: input.content.trim(),
          category: input.category?.trim() || null,
          source: 'manual',
        })
        .returning();
      return created;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(3).max(500),
        category: z.string().max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(schema.userMemory)
        .set({ content: input.content.trim(), category: input.category?.trim() || null })
        .where(
          and(
            eq(schema.userMemory.id, input.id),
            eq(schema.userMemory.userId, ctx.userId),
            eq(schema.userMemory.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(schema.userMemory)
        .where(
          and(
            eq(schema.userMemory.id, input.id),
            eq(schema.userMemory.userId, ctx.userId),
            eq(schema.userMemory.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),

  clearAll: tenantProcedure.mutation(async ({ ctx }) => {
    await db
      .delete(schema.userMemory)
      .where(
        and(
          eq(schema.userMemory.tenantId, ctx.tenantId),
          eq(schema.userMemory.userId, ctx.userId)
        )
      );
    return { ok: true };
  }),
});
