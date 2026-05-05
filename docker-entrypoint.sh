#!/bin/sh
set -e

echo "▸ ENTUR AI · iniciando container..."
echo "  NODE_ENV=$NODE_ENV"
echo "  PORT=$PORT"

# Aplica migrations Drizzle no Postgres (idempotente, com retry)
cd /app/packages/db
echo "▸ Aplicando migrations Drizzle..."
for i in 1 2 3 4 5; do
  if node --import tsx ./src/migrate.ts 2>&1; then
    echo "  ✓ migrations aplicadas"
    break
  fi
  echo "  tentativa $i falhou, aguardando 5s..."
  sleep 5
done

cd /app/apps/api
echo "▸ Iniciando API + Web (porta $PORT)..."
exec "$@"
