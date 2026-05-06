import { z } from 'zod';
import { router, tenantProcedure } from '../trpc';
import { db, schema } from '@entur-ai/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const conversationsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: schema.conversation.id,
        title: schema.conversation.title,
        model: schema.conversation.model,
        pinned: schema.conversation.pinned,
        archived: schema.conversation.archived,
        updatedAt: schema.conversation.updatedAt,
        createdAt: schema.conversation.createdAt,
      })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.tenantId, ctx.tenantId),
          eq(schema.conversation.userId, ctx.userId),
          eq(schema.conversation.archived, false)
        )
      )
      .orderBy(desc(schema.conversation.pinned), desc(schema.conversation.updatedAt))
      .limit(200);
    return rows;
  }),

  get: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.conversation)
        .where(
          and(
            eq(schema.conversation.id, input.id),
            eq(schema.conversation.tenantId, ctx.tenantId),
            eq(schema.conversation.userId, ctx.userId)
          )
        )
        .limit(1);
      const conv = rows[0];
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

      const messages = await db
        .select()
        .from(schema.message)
        .where(eq(schema.message.conversationId, conv.id))
        .orderBy(asc(schema.message.createdAt));

      return { ...conv, messages };
    }),

  create: tenantProcedure
    .input(z.object({ title: z.string().optional(), model: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(schema.conversation)
        .values({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          title: input.title || 'Nova conversa',
          model: input.model || null,
        })
        .returning();
      return created;
    }),

  rename: tenantProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(schema.conversation)
        .set({ title: input.title })
        .where(
          and(
            eq(schema.conversation.id, input.id),
            eq(schema.conversation.userId, ctx.userId),
            eq(schema.conversation.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),

  togglePin: tenantProcedure
    .input(z.object({ id: z.string().uuid(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(schema.conversation)
        .set({ pinned: input.pinned })
        .where(
          and(
            eq(schema.conversation.id, input.id),
            eq(schema.conversation.userId, ctx.userId),
            eq(schema.conversation.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(schema.conversation)
        .where(
          and(
            eq(schema.conversation.id, input.id),
            eq(schema.conversation.userId, ctx.userId),
            eq(schema.conversation.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),
});
