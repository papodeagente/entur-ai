import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurado');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('🔌 Conectando ao banco...');
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  console.log('✓ extensões habilitadas');

  // Procura a pasta drizzle (dev: ../drizzle ; runner compilado: ./drizzle)
  const candidates = [
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(__dirname, '../drizzle'),
    path.resolve(__dirname, './drizzle'),
  ];
  const migrationsFolder = candidates.find((p) => fs.existsSync(p));
  if (!migrationsFolder) {
    throw new Error(`Pasta drizzle/ não encontrada. Tentativas: ${candidates.join(', ')}`);
  }
  console.log(`📁 migrations em: ${migrationsFolder}`);

  console.log('📝 Aplicando migrations...');
  await migrate(db, { migrationsFolder });
  console.log('✓ Migrations aplicadas');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Falha na migration:', err);
  process.exit(1);
});
