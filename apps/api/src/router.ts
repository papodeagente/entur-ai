import { router, publicProcedure, tenantProcedure } from './trpc';
import { conversationsRouter } from './routers/conversations';
import { settingsRouter } from './routers/settings';
import { MODELS } from '@entur-ai/ai';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),

  me: tenantProcedure.query(({ ctx }) => ({
    id: ctx.userId,
    email: ctx.email,
    role: ctx.role,
    department: ctx.department,
    tenantId: ctx.tenantId,
  })),

  models: publicProcedure.query(() => MODELS),

  conversations: conversationsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
