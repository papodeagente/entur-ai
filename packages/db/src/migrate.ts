import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurado');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('🔌 Conectando ao banco...');
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('✓ pgvector habilitado');

  console.log('📝 Aplicando migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✓ Migrations aplicadas');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Falha na migration:', err);
  process.exit(1);
});
