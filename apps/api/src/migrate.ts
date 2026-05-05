import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    console.log('  ✓ extensões pgvector + pgcrypto habilitadas');

    const candidates = [
      path.resolve(__dirname, '../drizzle'),
      path.resolve(__dirname, './drizzle'),
      path.resolve(process.cwd(), 'drizzle'),
      path.resolve(process.cwd(), '../drizzle'),
    ];
    const migrationsFolder = candidates.find((p) => fs.existsSync(p));
    if (!migrationsFolder) {
      throw new Error(
        `Pasta drizzle/ não encontrada. Tentativas: ${candidates.join(', ')}`
      );
    }
    console.log(`  📁 migrations em: ${migrationsFolder}`);

    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    console.log('  ✓ migrations aplicadas');
  } finally {
    await client.end();
  }
}
