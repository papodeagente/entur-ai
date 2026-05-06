import { z } from 'zod';
import { router, tenantProcedure } from '../trpc';
import { db, schema } from '@entur-ai/db';
import { and, eq } from 'drizzle-orm';

export const profileRouter = router({
  getMine: tenantProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        name: schema.user.name,
        image: schema.user.image,
        role: schema.user.role,
        department: schema.user.department,
        jobTitle: schema.user.jobTitle,
        onboarded: schema.user.onboarded,
        writingStyle: schema.user.writingStyle,
        interests: schema.user.interests,
      })
      .from(schema.user)
      .where(and(eq(schema.user.id, ctx.userId), eq(schema.user.tenantId, ctx.tenantId)))
      .limit(1);
    return rows[0] ?? null;
  }),

  updateMine: tenantProcedure
    .input(
      z.object({
        department: z
          .enum(['vendas', 'conteudo', 'marketing', 'suporte', 'produto', 'mentoria', 'financeiro', 'diretoria', 'outros'])
          .optional(),
        jobTitle: z.string().max(120).optional(),
        writingStyle: z.string().max(2000).optional(),
        interests: z.array(z.string().max(80)).max(15).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const set: any = {};
      if (input.department !== undefined) set.department = input.department;
      if (input.jobTitle !== undefined) set.jobTitle = input.jobTitle.trim() || null;
      if (input.writingStyle !== undefined) set.writingStyle = input.writingStyle.trim() || null;
      if (input.interests !== undefined) set.interests = input.interests as any;

      if (Object.keys(set).length === 0) return { ok: true };

      await db
        .update(schema.user)
        .set(set)
        .where(and(eq(schema.user.id, ctx.userId), eq(schema.user.tenantId, ctx.tenantId)));
      return { ok: true };
    }),

  completeOnboarding: tenantProcedure
    .input(
      z.object({
        department: z
          .enum(['vendas', 'conteudo', 'marketing', 'suporte', 'produto', 'mentoria', 'financeiro', 'diretoria', 'outros'])
          .optional(),
        jobTitle: z.string().max(120).optional(),
        writingStyle: z.string().max(2000).optional(),
        interests: z.array(z.string().max(80)).max(15).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const set: any = { onboarded: true };
      if (input.department !== undefined) set.department = input.department;
      if (input.jobTitle !== undefined) set.jobTitle = input.jobTitle.trim() || null;
      if (input.writingStyle !== undefined) set.writingStyle = input.writingStyle.trim() || null;
      if (input.interests !== undefined) set.interests = input.interests as any;
      await db
        .update(schema.user)
        .set(set)
        .where(and(eq(schema.user.id, ctx.userId), eq(schema.user.tenantId, ctx.tenantId)));
      return { ok: true };
    }),

  skipOnboarding: tenantProcedure.mutation(async ({ ctx }) => {
    await db
      .update(schema.user)
      .set({ onboarded: true })
      .where(and(eq(schema.user.id, ctx.userId), eq(schema.user.tenantId, ctx.tenantId)));
    return { ok: true };
  }),
});
