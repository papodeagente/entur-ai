import { z } from 'zod';
import { router, tenantProcedure } from '../trpc';
import { getKeyStatus, setApiKey, deleteApiKey } from '../services/settings';

const providerSchema = z.enum(['openai', 'anthropic', 'gemini']);

export const settingsRouter = router({
  apiKeys: tenantProcedure.query(async () => {
    return await getKeyStatus();
  }),

  setApiKey: tenantProcedure
    .input(z.object({ provider: providerSchema, apiKey: z.string().min(8) }))
    .mutation(async ({ input }) => {
      await setApiKey(input.provider, input.apiKey);
      return { ok: true };
    }),

  deleteApiKey: tenantProcedure
    .input(z.object({ provider: providerSchema }))
    .mutation(async ({ input }) => {
      await deleteApiKey(input.provider);
      return { ok: true };
    }),
});
