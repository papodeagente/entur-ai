import { env } from './env';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { appRouter } from './router';
import { createContext } from './trpc';

async function main() {
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

  const io = new SocketServer(server, {
    cors: { origin: env.APP_URL, credentials: true },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    socket.emit('hello', { ts: Date.now() });
  });

  // Serve web static build em produção
  if (env.NODE_ENV === 'production') {
    const webDist = path.resolve(process.cwd(), '../web/dist');
    const fallbackDist = path.resolve(process.cwd(), 'public');
    const distPath = fs.existsSync(webDist) ? webDist : fallbackDist;

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

  server.listen(env.PORT, () => {
    console.log(`✓ ENTUR AI api listening on :${env.PORT}`);
    console.log(`  app url: ${env.APP_URL}`);
    console.log(`  env: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error('❌ Falha ao iniciar API:', err);
  process.exit(1);
});
