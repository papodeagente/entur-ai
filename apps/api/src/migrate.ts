import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const candidates = [
    path.resolve(__dirname, '../drizzle'),
    path.resolve(__dirname, './drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(process.cwd(), '../drizzle'),
  ];
  const migrationsFolder = candidates.find((p) => fs.existsSync(p));
  if (!migrationsFolder) {
    throw new Error(`Pasta drizzle/ não encontrada. Tentativas: ${candidates.join(', ')}`);
  }
  console.log(`  📁 migrations em: ${migrationsFolder}`);

  const sqlFiles = fs
    .readdirSync(migrationsFolder)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.warn('  ⚠ nenhum arquivo .sql na pasta drizzle/');
    return;
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    for (const file of sqlFiles) {
      const sqlText = fs.readFileSync(path.join(migrationsFolder, file), 'utf8');
      console.log(`  ▸ aplicando ${file} (${sqlText.length} bytes)`);
      // .simple() permite múltiplos statements + DO $$ blocks num único arquivo
      await client.unsafe(sqlText).simple();
      console.log(`    ✓ ${file} aplicado`);
    }
  } finally {
    await client.end();
  }
}
