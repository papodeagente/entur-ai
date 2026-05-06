import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { auth } from './auth';
import { db, schema } from '@entur-ai/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { streamChat, getModel, humanizeProviderError, type ChatMessage } from '@entur-ai/ai';
import { retrieve } from '@entur-ai/rag';
import { getApiKey } from './services/settings';
import { generateTitle, extractMemories } from './services/aiTasks';

const TENANT_ID = 'entur';

const BASE_SYSTEM_PROMPT =
  'Você é o ENTUR AI, copiloto interno da Escola de Negócios do Turismo. ' +
  'Responda sempre em português brasileiro, com objetividade e densidade. ' +
  'Use markdown quando ajudar (listas, código, tabelas). ' +
  'Quando o usuário pedir conteúdo para a Entur (Papo de Agente, vendas SPIN, mentorias), siga o tom da casa: claro, prático, sem caixa alta, sem manchetes sensacionalistas. ' +
  'Mulher como decisora; nada de hífens estilizados; nada de padrões de IA óbvios.';

interface SocketUser {
  id: string;
  email: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export function attachSocket(httpServer: HttpServer, _appUrl: string): SocketServer {
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
        if (!socket.user) return ack({ ok: false, error: 'UNAUTHORIZED' });
        if (!conversationId || !content?.trim() || !modelId)
          return ack({ ok: false, error: 'invalid_payload' });
        const model = getModel(modelId);
        if (!model) return ack({ ok: false, error: 'invalid_model' });

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
        if (!conv) return ack({ ok: false, error: 'conversation_not_found' });

        const apiKey = await getApiKey(model.provider);
        if (!apiKey) {
          return ack({
            ok: false,
            error: 'missing_api_key',
            message: `Chave ${model.provider.toUpperCase()} não cadastrada. Vá em Configurações > Chaves de IA.`,
          });
        }
        const openaiKey = await getApiKey('openai'); // p/ embeddings + tasks

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
        socket.emit('chat.user_message', { conversationId: conv.id, message: userMsg });

        const isFirstExchange = previous.length === 0;
        await db
          .update(schema.conversation)
          .set({ model: modelId, updatedAt: new Date() })
          .where(eq(schema.conversation.id, conv.id));

        ack({ ok: true });
        socket.emit('chat.start', { conversationId: conv.id, modelId });

        // ====== RAG: retrieval ======
        let kbChunks: Array<{ chunkId: string; documentId: string; documentTitle: string; content: string }> = [];
        if (openaiKey) {
          try {
            socket.emit('chat.rag_searching', { conversationId: conv.id });
            const matches = await retrieve({
              tenantId: TENANT_ID,
              query: content,
              apiKey: openaiKey,
              topK: 5,
              minSimilarity: 0.35,
            });
            kbChunks = matches.map((m) => ({
              chunkId: m.chunkId,
              documentId: m.documentId,
              documentTitle: m.documentTitle,
              content: m.content,
            }));
          } catch (err) {
            // RAG é melhor-esforço; não bloqueia o chat
            console.warn('RAG retrieve falhou:', err instanceof Error ? err.message : err);
          }
        }

        // ====== Memórias do usuário ======
        const memoryRows = await db
          .select({ content: schema.userMemory.content, category: schema.userMemory.category })
          .from(schema.userMemory)
          .where(
            and(
              eq(schema.userMemory.tenantId, TENANT_ID),
              eq(schema.userMemory.userId, socket.user.id)
            )
          )
          .orderBy(desc(schema.userMemory.updatedAt))
          .limit(50);

        // ====== Construir system prompt enriquecido ======
        const sysParts: string[] = [BASE_SYSTEM_PROMPT];
        if (memoryRows.length > 0) {
          sysParts.push(
            '## Memórias sobre o usuário (use para personalizar, mas não force referências)',
            memoryRows.map((m, i) => `${i + 1}. ${m.content}${m.category ? ` (${m.category})` : ''}`).join('\n')
          );
        }
        if (kbChunks.length > 0) {
          sysParts.push(
            '## Conhecimento institucional ENTUR (use SOMENTE se for útil; sempre que usar, cite a fonte com [Fonte: <título>])',
            kbChunks
              .map((c, i) => `### Fonte ${i + 1}: ${c.documentTitle}\n${c.content}`)
              .join('\n\n')
          );
        }
        const systemPrompt = sysParts.join('\n\n');

        // ====== Stream ======
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...previous.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content },
        ];

        let assistantText = '';
        try {
          for await (const delta of streamChat({ modelId, messages, apiKey })) {
            assistantText += delta;
            socket.emit('chat.delta', { conversationId: conv.id, text: delta });
          }
        } catch (err) {
          const friendly = humanizeProviderError(err, model.provider, modelId);
          socket.emit('chat.error', { conversationId: conv.id, message: friendly });
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

        // ====== Persistir assistant message + citations ======
        const citations =
          kbChunks.length > 0
            ? kbChunks.map((c) => ({
                documentId: c.documentId,
                documentTitle: c.documentTitle,
                snippet: c.content.slice(0, 220),
              }))
            : null;

        const [assistantMsg] = await db
          .insert(schema.message)
          .values({
            conversationId: conv.id,
            tenantId: TENANT_ID,
            role: 'assistant',
            content: assistantText,
            model: modelId,
            provider: model.provider,
            citations: citations as any,
          })
          .returning();

        socket.emit('chat.done', {
          conversationId: conv.id,
          message: assistantMsg,
          citations,
        });

        await db.insert(schema.usageLog).values({
          tenantId: TENANT_ID,
          userId: socket.user.id,
          conversationId: conv.id,
          messageId: assistantMsg.id,
          provider: model.provider,
          model: modelId,
          latencyMs: Date.now() - startedAt,
        });

        // ====== Background: auto-título + extração de memórias ======
        if (openaiKey) {
          // Auto-título na primeira troca
          if (isFirstExchange && conv.title === 'Nova conversa') {
            generateTitle({
              apiKey: openaiKey,
              userMessage: content,
              assistantReply: assistantText,
            })
              .then(async (newTitle) => {
                if (newTitle) {
                  await db
                    .update(schema.conversation)
                    .set({ title: newTitle })
                    .where(eq(schema.conversation.id, conv.id));
                  socket.emit('conversation.updated', {
                    id: conv.id,
                    title: newTitle,
                    model: modelId,
                  });
                }
              })
              .catch(() => {});
          }

          // Extração de memórias
          const userId = socket.user.id;
          extractMemories({
            apiKey: openaiKey,
            userMessage: content,
            assistantReply: assistantText,
            existingMemories: memoryRows.map((m) => m.content),
          })
            .then(async (extracted) => {
              if (extracted.length === 0) return;
              for (const m of extracted) {
                const [created] = await db
                  .insert(schema.userMemory)
                  .values({
                    tenantId: TENANT_ID,
                    userId,
                    content: m.content,
                    category: m.category || null,
                    sourceConvId: conv.id,
                    source: 'auto_extract',
                  })
                  .returning();
                socket.emit('memory.added', { memory: created });
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        socket.emit('chat.error', { message: msg });
      }
    });
  });

  return io;
}
