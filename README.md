# ENTUR AI

Copiloto interno da Escola de Negócios do Turismo. Multi-LLM (Claude · Gemini · OpenAI) com memória persistente, biblioteca de prompts, KB institucional via RAG.

## Stack

- **Frontend**: Vite + React 18 + TS + Tailwind + shadcn/ui + Framer Motion
- **API**: Express + tRPC v11 + Socket.IO
- **DB**: Postgres 16 + pgvector (Drizzle ORM)
- **Filas**: BullMQ + Redis
- **Auth**: Better Auth + Google OAuth (restrito a `@entur.com.br`)
- **Storage**: S3-compatible (MinIO em produção - Fase 3)
- **Build**: Turborepo + pnpm

## Estrutura

```
apps/
  web/                  # Vite + React (UI)
  api/                  # Express + tRPC + Socket.IO
packages/
  db/                   # Drizzle schema + migrations + client
  ai/                   # Wrappers Claude/Gemini/OpenAI
  rag/                  # Indexer + retriever (pgvector)
  ui/                   # Componentes shadcn customizados
  shared/               # Tipos zod, utils, constantes
```

## Dev local

```bash
pnpm install
cp .env.example .env  # preencha
pnpm db:migrate
pnpm dev
```

## Princípios

1. **Velocidade é design** — streaming < 400ms, skeleton em tudo
2. **Densidade calma** — Linear/Vercel/Claude.ai, não Notion/Slack
3. **Dark mode primeiro** — navy + teal
4. **Multi-tenant security** — toda query filtra `tenantId` do contexto, nunca do client
5. **SQL antes de migrar** — gerar SQL e revisar antes de aplicar

Ver `PROMPT.md` para a especificação completa.
