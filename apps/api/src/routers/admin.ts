import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { db, schema } from '@entur-ai/db';
import { sql, desc, eq, and, gte } from 'drizzle-orm';

const TENANT_ID = 'entur';

export const adminRouter = router({
  overview: adminProcedure
    .input(z.object({ days: z.number().min(1).max(180).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 86400000);

      const totals = await db
        .select({
          totalRequests: sql<number>`count(*)::int`,
          totalCostCents: sql<number>`coalesce(sum(${schema.usageLog.costCents}), 0)::int`,
          totalPromptTokens: sql<number>`coalesce(sum(${schema.usageLog.promptTokens}), 0)::int`,
          totalCompletionTokens: sql<number>`coalesce(sum(${schema.usageLog.completionTokens}), 0)::int`,
          errors: sql<number>`count(*) filter (where ${schema.usageLog.error} is not null)::int`,
        })
        .from(schema.usageLog)
        .where(
          and(
            eq(schema.usageLog.tenantId, TENANT_ID),
            gte(schema.usageLog.createdAt, since)
          )
        );

      const distinctUsers = await db.execute(sql`
        SELECT count(DISTINCT user_id)::int as n
        FROM usage_log
        WHERE tenant_id = ${TENANT_ID} AND created_at >= ${since}
      `);

      const byDay = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day,
               count(*)::int as requests,
               coalesce(sum(cost_cents),0)::int as cost_cents
        FROM usage_log
        WHERE tenant_id = ${TENANT_ID} AND created_at >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      const byModel = await db.execute(sql`
        SELECT model, provider,
               count(*)::int as requests,
               coalesce(sum(cost_cents),0)::int as cost_cents,
               coalesce(sum(prompt_tokens),0)::int as prompt_tokens,
               coalesce(sum(completion_tokens),0)::int as completion_tokens
        FROM usage_log
        WHERE tenant_id = ${TENANT_ID} AND created_at >= ${since}
        GROUP BY model, provider
        ORDER BY requests DESC
        LIMIT 20
      `);

      const byUser = await db.execute(sql`
        SELECT u.id::text as user_id, u.email, u.name, u.department,
               count(l.*)::int as requests,
               coalesce(sum(l.cost_cents),0)::int as cost_cents
        FROM usage_log l
        JOIN "user" u ON u.id = l.user_id
        WHERE l.tenant_id = ${TENANT_ID} AND l.created_at >= ${since}
        GROUP BY u.id, u.email, u.name, u.department
        ORDER BY requests DESC
        LIMIT 20
      `);

      const byDept = await db.execute(sql`
        SELECT u.department,
               count(l.*)::int as requests,
               coalesce(sum(l.cost_cents),0)::int as cost_cents
        FROM usage_log l
        JOIN "user" u ON u.id = l.user_id
        WHERE l.tenant_id = ${TENANT_ID} AND l.created_at >= ${since}
        GROUP BY u.department
        ORDER BY requests DESC
      `);

      const recentErrors = await db
        .select({
          id: schema.usageLog.id,
          createdAt: schema.usageLog.createdAt,
          model: schema.usageLog.model,
          provider: schema.usageLog.provider,
          error: schema.usageLog.error,
        })
        .from(schema.usageLog)
        .where(
          and(
            eq(schema.usageLog.tenantId, TENANT_ID),
            sql`${schema.usageLog.error} IS NOT NULL`
          )
        )
        .orderBy(desc(schema.usageLog.createdAt))
        .limit(20);

      return {
        days: input.days,
        totals: {
          requests: totals[0]?.totalRequests ?? 0,
          costCents: totals[0]?.totalCostCents ?? 0,
          promptTokens: totals[0]?.totalPromptTokens ?? 0,
          completionTokens: totals[0]?.totalCompletionTokens ?? 0,
          errors: totals[0]?.errors ?? 0,
          activeUsers: ((distinctUsers as any).rows ?? distinctUsers)[0]?.n ?? 0,
        },
        byDay: ((byDay as any).rows ?? byDay) as Array<{
          day: string;
          requests: number;
          cost_cents: number;
        }>,
        byModel: ((byModel as any).rows ?? byModel) as Array<{
          model: string;
          provider: string;
          requests: number;
          cost_cents: number;
          prompt_tokens: number;
          completion_tokens: number;
        }>,
        byUser: ((byUser as any).rows ?? byUser) as Array<{
          user_id: string;
          email: string;
          name: string | null;
          department: string;
          requests: number;
          cost_cents: number;
        }>,
        byDept: ((byDept as any).rows ?? byDept) as Array<{
          department: string;
          requests: number;
          cost_cents: number;
        }>,
        recentErrors,
      };
    }),
});
