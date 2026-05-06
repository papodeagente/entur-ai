import { env } from './env';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { appRouter } from './router';
import { createContext } from './trpc';
import { runMigrations } from './migrate';
import { attachSocket } from './socket';

async function main() {
  console.log('▸ ENTUR AI api · iniciando…');
  console.log(`  NODE_ENV=${env.NODE_ENV}`);
  console.log(`  PORT=${env.PORT}`);
  console.log(`  APP_URL=${env.APP_URL}`);

  if (env.NODE_ENV === 'production') {
    console.log('▸ Aplicando migrations…');
    let lastErr: unknown = null;
    for (let i = 1; i <= 5; i++) {
      try {
        await runMigrations(env.DATABASE_URL);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`  tentativa ${i} falhou: ${err instanceof Error ? err.message : err}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (lastErr) {
      console.error('  ⚠ migrations falharam após 5 tentativas; iniciando assim mesmo');
    }
  }

  const app = express();
  const server = createServer(app);

  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? true : env.APP_URL,
      credentials: true,
    })
  );

  app.set('trust proxy', 1);

  // Better Auth handler — antes do bodyParser para preservar streams
  app.all('/api/auth/*', toNodeHandler(auth));

  app.use(express.json({ limit: '4mb' }));

  app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  attachSocket(server, env.APP_URL);

  // Serve web static build em produção
  if (env.NODE_ENV === 'production') {
    const candidates = [
      path.resolve(__dirname, '../web-dist'),
      path.resolve(__dirname, './web-dist'),
      path.resolve(process.cwd(), 'web-dist'),
      path.resolve(process.cwd(), '../web/dist'),
    ];
    const distPath = candidates.find((p) => fs.existsSync(p)) || candidates[0];

    if (fs.existsSync(distPath)) {
      console.log(`✓ servindo web estático de: ${distPath}`);
      app.use(express.static(distPath, { maxAge: '1h', index: false }));

      // SPA fallback (todas as rotas que não são API → index.html)
      app.get('*', (req, res, next) => {
        if (
          req.path.startsWith('/api/') ||
          req.path.startsWith('/trpc') ||
          req.path.startsWith('/socket.io') ||
          req.path === '/healthz'
        ) {
          return next();
        }
        const indexHtml = path.join(distPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(404).send('index.html não encontrado');
        }
      });
    } else {
      console.warn(`⚠ web build não encontrado em ${distPath}`);
    }
  }

  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`✓ ENTUR AI rodando em :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('❌ Falha ao iniciar API:', err);
  process.exit(1);
});
