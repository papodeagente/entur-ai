import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../trpc';
import { db, schema } from '@entur-ai/db';
import { and, asc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { ensurePromptsSeeded } from '../services/seedPrompts';

const variableSchema = z.array(
  z.object({
    name: z.string().min(1).max(60),
    label: z.string().min(1).max(120),
    placeholder: z.string().max(200).optional(),
    type: z.enum(['text', 'textarea']).optional(),
    default: z.string().max(2000).optional(),
  })
);

export const promptsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    await ensurePromptsSeeded();
    return await db
      .select()
      .from(schema.promptTemplate)
      .where(eq(schema.promptTemplate.tenantId, ctx.tenantId))
      .orderBy(asc(schema.promptTemplate.category), asc(schema.promptTemplate.title));
  }),

  get: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(schema.promptTemplate)
        .where(
          and(
            eq(schema.promptTemplate.id, input.id),
            eq(schema.promptTemplate.tenantId, ctx.tenantId)
          )
        )
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND' });
      return rows[0];
    }),

  create: adminProcedure
    .input(
      z.object({
        category: z.enum(['vendas', 'conteudo', 'mentoria', 'produto', 'operacional', 'outros']),
        title: z.string().min(2).max(200),
        body: z.string().min(10),
        variables: variableSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(schema.promptTemplate)
        .values({
          tenantId: ctx.tenantId,
          category: input.category,
          title: input.title,
          body: input.body,
          variables: (input.variables ?? []) as any,
          createdBy: ctx.userId,
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        category: z
          .enum(['vendas', 'conteudo', 'mentoria', 'produto', 'operacional', 'outros'])
          .optional(),
        title: z.string().min(2).max(200).optional(),
        body: z.string().min(10).optional(),
        variables: variableSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const set: any = {};
      if (input.category !== undefined) set.category = input.category;
      if (input.title !== undefined) set.title = input.title;
      if (input.body !== undefined) set.body = input.body;
      if (input.variables !== undefined) set.variables = input.variables as any;
      await db
        .update(schema.promptTemplate)
        .set(set)
        .where(
          and(
            eq(schema.promptTemplate.id, input.id),
            eq(schema.promptTemplate.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(schema.promptTemplate)
        .where(
          and(
            eq(schema.promptTemplate.id, input.id),
            eq(schema.promptTemplate.tenantId, ctx.tenantId)
          )
        );
      return { ok: true };
    }),
});
