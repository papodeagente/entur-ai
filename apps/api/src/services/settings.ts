import { db, schema } from '@entur-ai/db';
import { eq, and } from 'drizzle-orm';
import type { Provider } from '@entur-ai/ai';
import { encryptSecret, decryptSecret } from '../crypto';

const TENANT_ID = 'entur';

const KEY_BY_PROVIDER: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

export async function getApiKey(provider: Provider): Promise<string | null> {
  const k = KEY_BY_PROVIDER[provider];
  const rows = await db
    .select()
    .from(schema.tenantSetting)
    .where(and(eq(schema.tenantSetting.tenantId, TENANT_ID), eq(schema.tenantSetting.key, k)))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return decryptSecret(rows[0].value);
  } catch {
    return null;
  }
}

export async function setApiKey(provider: Provider, value: string): Promise<void> {
  const k = KEY_BY_PROVIDER[provider];
  const encrypted = encryptSecret(value.trim());
  await db
    .insert(schema.tenantSetting)
    .values({ tenantId: TENANT_ID, key: k, value: encrypted })
    .onConflictDoUpdate({
      target: [schema.tenantSetting.tenantId, schema.tenantSetting.key],
      set: { value: encrypted },
    });
}

export async function deleteApiKey(provider: Provider): Promise<void> {
  const k = KEY_BY_PROVIDER[provider];
  await db
    .delete(schema.tenantSetting)
    .where(and(eq(schema.tenantSetting.tenantId, TENANT_ID), eq(schema.tenantSetting.key, k)));
}

export async function getKeyStatus(): Promise<
  Record<Provider, { configured: boolean; preview: string | null }>
> {
  const out = {} as Record<Provider, { configured: boolean; preview: string | null }>;
  for (const p of Object.keys(KEY_BY_PROVIDER) as Provider[]) {
    const k = await getApiKey(p);
    out[p] = k
      ? { configured: true, preview: k.slice(0, 4) + '…' + k.slice(-4) }
      : { configured: false, preview: null };
  }
  return out;
}
