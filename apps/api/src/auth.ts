import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@entur-ai/db';
import * as schema from '@entur-ai/db/schema';
import { env } from './env';

const googleConfigured = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: env.APP_URL,
  secret: env.APP_SECRET,
  trustedOrigins: [env.APP_URL],
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  emailAndPassword: {
    enabled: false,
  },
  user: {
    additionalFields: {
      tenantId: { type: 'string', defaultValue: 'entur', input: false },
      role: { type: 'string', defaultValue: 'member', input: false },
      department: { type: 'string', defaultValue: 'outros' },
      jobTitle: { type: 'string', required: false },
    },
  },
  callbacks: {
    async signIn({ user }: any) {
      const allowed = env.ALLOWED_EMAIL_DOMAIN.toLowerCase();
      const emailDomain = (user.email || '').split('@')[1]?.toLowerCase();
      if (!emailDomain || emailDomain !== allowed) {
        throw new Error(
          `Acesso restrito a colaboradores @${allowed}. Use sua conta corporativa.`
        );
      }
      return true;
    },
  },
});

export type Session = typeof auth.$Infer.Session;
