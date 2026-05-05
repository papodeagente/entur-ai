import { router, publicProcedure, tenantProcedure } from './trpc';
import { z } from 'zod';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),

  me: tenantProcedure.query(({ ctx }) => ({
    id: ctx.userId,
    email: ctx.email,
    role: ctx.role,
    department: ctx.department,
    tenantId: ctx.tenantId,
  })),
});

export type AppRouter = typeof appRouter;
