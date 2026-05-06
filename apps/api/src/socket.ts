import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { auth } from './auth';
import { db, schema } from '@entur-ai/db';
import { and, asc, eq } from 'drizzle-orm';
import { streamChat, getModel, humanizeProviderError, type ChatMessage } from '@entur-ai/ai';
import { getApiKey } from './services/settings';

const TENANT_ID = 'entur';
const SYSTEM_PROMPT =
  'Você é o ENTUR AI, copiloto interno da Escola de Negócios do Turismo. ' +
  'Responda sempre em português brasileiro, com objetividade e densidade. ' +
  'Use markdown quando ajudar (listas, código, tabelas). ' +
  'Quando o usuário pedir conteúdo para a Entur (Papo de Agente, vendas SPIN, mentorias), siga o tom da casa: claro, prático, sem caixa alta, sem manchetes sensacionalistas.';

interface SocketUser {
  id: string;
  email: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export function attachSocket(httpServer: HttpServer, appUrl: string): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next(new Error('UNAUTHORIZED'));
      const headers = new Headers();
      headers.set('cookie', cookieHeader);
      const session = await auth.api.getSession({ headers });
      if (!session?.user) return next(new Error('UNAUTHORIZED'));
      socket.user = { id: session.user.id, email: session.user.email };
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.emit('hello', { userId: socket.user?.id });

    socket.on('chat.send', async (payload, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const startedAt = Date.now();
      try {
        const { conversationId, content, modelId } = payload as {
          conversationId: string;
          content: string;
          modelId: string;
        };
        if (!socket.user) {
          ack({ ok: false, error: 'UNAUTHORIZED' });
          return;
        }
        if (!conversationId || !content?.trim() || !modelId) {
          ack({ ok: false, error: 'invalid_payload' });
          return;
        }
        const model = getModel(modelId);
        if (!model) {
          ack({ ok: false, error: 'invalid_model' });
          return;
        }

        // Verificar conversa pertence ao usuário
        const convs = await db
          .select()
          .from(schema.conversation)
          .where(
            and(
              eq(schema.conversation.id, conversationId),
              eq(schema.conversation.userId, socket.user.id),
              eq(schema.conversation.tenantId, TENANT_ID)
            )
          )
          .limit(1);
        const conv = convs[0];
        if (!conv) {
          ack({ ok: false, error: 'conversation_not_found' });
          return;
        }

        // Buscar API key
        const apiKey = await getApiKey(model.provider);
        if (!apiKey) {
          ack({
            ok: false,
            error: 'missing_api_key',
            message: `Chave ${model.provider.toUpperCase()} não cadastrada. Vá em Configurações > Chaves de IA.`,
          });
          return;
        }

        // Histórico
        const previous = await db
          .select({ role: schema.message.role, content: schema.message.content })
          .from(schema.message)
          .where(eq(schema.message.conversationId, conv.id))
          .orderBy(asc(schema.message.createdAt));

        // Persistir user message
        const [userMsg] = await db
          .insert(schema.message)
          .values({
            conversationId: conv.id,
            tenantId: TENANT_ID,
            role: 'user',
            content,
          })
          .returning();

        // Notificar UI que a user message foi salva (com ID)
        socket.emit('chat.user_message', {
          conversationId: conv.id,
          message: userMsg,
        });

        // Atualizar título inteligente se for a primeira mensagem
        const isFirstExchange = previous.length === 0;
        if (isFirstExchange && conv.title === 'Nova conversa') {
          const newTitle = content.replace(/\n/g, ' ').slice(0, 60).trim() || 'Nova conversa';
          await db
            .update(schema.conversation)
            .set({ title: newTitle, model: modelId })
            .where(eq(schema.conversation.id, conv.id));
          socket.emit('conversation.updated', { id: conv.id, title: newTitle, model: modelId });
        } else {
          await db
            .update(schema.conversation)
            .set({ model: modelId, updatedAt: new Date() })
            .where(eq(schema.conversation.id, conv.id));
        }

        // Stream
        ack({ ok: true });
        socket.emit('chat.start', { conversationId: conv.id, modelId });

        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...previous.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content },
        ];

        let assistantText = '';
        try {
          for await (const delta of streamChat({
            modelId,
            messages,
            apiKey,
          })) {
            assistantText += delta;
            socket.emit('chat.delta', { conversationId: conv.id, text: delta });
          }
        } catch (err) {
          const friendly = humanizeProviderError(err, model.provider, modelId);
          socket.emit('chat.error', { conversationId: conv.id, message: friendly });
          // Loga uso com erro
          await db.insert(schema.usageLog).values({
            tenantId: TENANT_ID,
            userId: socket.user.id,
            conversationId: conv.id,
            provider: model.provider,
            model: modelId,
            error: friendly.slice(0, 480),
            latencyMs: Date.now() - startedAt,
          });
          return;
        }

        // Persistir assistant message
        const [assistantMsg] = await db
          .insert(schema.message)
          .values({
            conversationId: conv.id,
            tenantId: TENANT_ID,
            role: 'assistant',
            content: assistantText,
            model: modelId,
            provider: model.provider,
          })
          .returning();

        socket.emit('chat.done', {
          conversationId: conv.id,
          message: assistantMsg,
        });

        // Audit log
        await db.insert(schema.usageLog).values({
          tenantId: TENANT_ID,
          userId: socket.user.id,
          conversationId: conv.id,
          messageId: assistantMsg.id,
          provider: model.provider,
          model: modelId,
          latencyMs: Date.now() - startedAt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        socket.emit('chat.error', { message: msg });
      }
    });
  });

  return io;
}
