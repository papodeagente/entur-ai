import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { auth } from './auth';
import { TENANT_ID } from '@entur-ai/shared';

export interface Context {
  userId: string | null;
  tenantId: string;
  email: string | null;
  role: string;
  department: string;
}

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      return {
        userId: session.user.id,
        tenantId: (session.user as any).tenantId || TENANT_ID,
        email: session.user.email,
        role: (session.user as any).role || 'member',
        department: (session.user as any).department || 'outros',
      };
    }
  } catch {}
  return {
    userId: null,
    tenantId: TENANT_ID,
    email: null,
    role: 'member',
    department: 'outros',
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Faça login para continuar' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId as string,
    },
  });
});

export const tenantWriteProcedure = tenantProcedure;

export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.role !== 'admin' && ctx.role !== 'director') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito à diretoria/admin' });
  }
  return next();
});

export function getTenantId(ctx: Context): string {
  return ctx.tenantId;
}
