import { router, publicProcedure, tenantProcedure } from './trpc';
import { conversationsRouter } from './routers/conversations';
import { settingsRouter } from './routers/settings';
import { memoriesRouter } from './routers/memories';
import { kbRouter } from './routers/kb';
import { promptsRouter } from './routers/prompts';
import { profileRouter } from './routers/profile';
import { adminRouter } from './routers/admin';
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
  memories: memoriesRouter,
  kb: kbRouter,
  prompts: promptsRouter,
  profile: profileRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
