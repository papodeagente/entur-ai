import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  APP_SECRET: z.string().min(16, 'APP_SECRET deve ter ao menos 16 caracteres'),
  APP_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().default('entur.com.br'),
});

export const env = envSchema.parse(process.env);
