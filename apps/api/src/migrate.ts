import { Client } from 'pg';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Splits a SQL string into individual statements, respecting $$ blocks
 * (PL/pgSQL DO blocks, function bodies, etc).
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollar = false;
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    const ahead2 = sql.slice(i, i + 2);

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ahead2 === '*/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (!inDollar && !inSingleQuote) {
      if (ahead2 === '--') {
        inLineComment = true;
        current += ch;
        continue;
      }
      if (ahead2 === '/*') {
        inBlockComment = true;
        current += ch;
        continue;
      }
    }

    if (!inDollar) {
      if (ch === "'" && !inSingleQuote) {
        inSingleQuote = true;
        current += ch;
        continue;
      }
      if (ch === "'" && inSingleQuote) {
        inSingleQuote = false;
        current += ch;
        continue;
      }
    }

    if (!inSingleQuote && ahead2 === '$$') {
      inDollar = !inDollar;
      current += '$$';
      i++;
      continue;
    }

    if (ch === ';' && !inDollar && !inSingleQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

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

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of sqlFiles) {
      const sqlText = fs.readFileSync(path.join(migrationsFolder, file), 'utf8');
      const statements = splitStatements(sqlText);
      console.log(`  ▸ ${file} (${statements.length} statements)`);
      let i = 0;
      for (const stmt of statements) {
        i++;
        try {
          await client.query(stmt);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`    ✗ statement ${i}/${statements.length} falhou: ${msg}`);
          console.error(`      SQL: ${stmt.slice(0, 200).replace(/\n/g, ' ')}...`);
          throw err;
        }
      }
      console.log(`    ✓ ${file} aplicado (${statements.length} statements)`);
    }
  } finally {
    await client.end();
  }
}
