FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ===== Builder (com devDeps) =====
FROM base AS builder
ENV NODE_ENV=development
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile=false --ignore-scripts=false
RUN pnpm --filter @entur-ai/web build
RUN pnpm --filter @entur-ai/api build

# ===== Runner (mínimo: apenas server.js bundled + assets) =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 entur

# server.js já é um bundle único (esbuild), então node_modules não é necessário
COPY --from=builder --chown=entur:nodejs /repo/apps/api/dist/server.js ./server.js
COPY --from=builder --chown=entur:nodejs /repo/apps/web/dist ./web-dist
COPY --from=builder --chown=entur:nodejs /repo/packages/db/drizzle ./drizzle

USER entur
EXPOSE 3001

CMD ["node", "server.js"]
