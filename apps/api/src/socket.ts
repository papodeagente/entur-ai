import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { auth } from './auth';
import { db, schema } from '@entur-ai/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  streamChat,
  generateImage,
  getModel,
  isImageModel,
  humanizeProviderError,
  estimateTokens,
  chatCostCents,
  imageCostCents,
  type Attachment,
  type ChatMessage,
  type ToolFlags,
} from '@entur-ai/ai';
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
    maxHttpBufferSize: 25 * 1024 * 1024, // 25MB para anexos
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
        const { conversationId, content, modelId, attachments, tools } = payload as {
          conversationId: string;
          content: string;
          modelId: string;
          attachments?: Attachment[];
          tools?: ToolFlags;
        };
        if (!socket.user) return ack({ ok: false, error: 'UNAUTHORIZED' });
        const hasContent = !!content?.trim() || (attachments?.length ?? 0) > 0;
        if (!conversationId || !hasContent || !modelId)
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
            message: `Chave ${model.provider.toUpperCase()} não cadastrada.`,
          });
        }
        const openaiKey = await getApiKey('openai');

        // Persistir user message com attachments
        const [userMsg] = await db
          .insert(schema.message)
          .values({
            conversationId: conv.id,
            tenantId: TENANT_ID,
            role: 'user',
            content,
            attachments: attachments?.length ? (attachments as any) : null,
          })
          .returning();
        socket.emit('chat.user_message', { conversationId: conv.id, message: userMsg });

        const previous = await db
          .select({
            role: schema.message.role,
            content: schema.message.content,
            attachments: schema.message.attachments,
          })
          .from(schema.message)
          .where(
            and(eq(schema.message.conversationId, conv.id), eq(schema.message.role, 'user'))
          )
          .orderBy(asc(schema.message.createdAt));

        // ressetimar histórico anterior + assistant
        const fullHistory = await db
          .select({
            role: schema.message.role,
            content: schema.message.content,
            attachments: schema.message.attachments,
          })
          .from(schema.message)
          .where(eq(schema.message.conversationId, conv.id))
          .orderBy(asc(schema.message.createdAt));
        // remove last (que acabamos de inserir) — vamos enviar ele separadamente
        const previousFull = fullHistory.slice(0, -1);

        const isFirstExchange = previousFull.length === 0;
        await db
          .update(schema.conversation)
          .set({ model: modelId, updatedAt: new Date() })
          .where(eq(schema.conversation.id, conv.id));

        ack({ ok: true });
        socket.emit('chat.start', { conversationId: conv.id, modelId });

        // ============ IMAGE GENERATION ============
        if (isImageModel(modelId)) {
          socket.emit('chat.tool_start', { conversationId: conv.id, tool: 'image_generation' });
          try {
            const firstImage = attachments?.find((a) => a.kind === 'image');
            const imgResult = await generateImage({
              modelId,
              prompt: content,
              apiKey,
              imageBase64: firstImage?.data,
              imageMime: firstImage?.mimeType,
            });
            socket.emit('chat.image', {
              conversationId: conv.id,
              mimeType: imgResult.mimeType,
              b64: imgResult.b64,
            });

            const imgCostCents = imageCostCents(modelId);
            const [assistantMsg] = await db
              .insert(schema.message)
              .values({
                conversationId: conv.id,
                tenantId: TENANT_ID,
                role: 'assistant',
                content: '',
                model: modelId,
                provider: model.provider,
                costCents: imgCostCents,
                outputs: { images: [imgResult] } as any,
              })
              .returning();

            socket.emit('chat.done', { conversationId: conv.id, message: assistantMsg });
            await db.insert(schema.usageLog).values({
              tenantId: TENANT_ID,
              userId: socket.user.id,
              conversationId: conv.id,
              messageId: assistantMsg.id,
              provider: model.provider,
              model: modelId,
              costCents: imgCostCents,
              latencyMs: Date.now() - startedAt,
            });

            // auto-titulo
            if (openaiKey && isFirstExchange && conv.title === 'Nova conversa' && content.trim()) {
              generateTitle({
                apiKey: openaiKey,
                userMessage: content,
                assistantReply: '(imagem gerada)',
              })
                .then(async (newTitle) => {
                  if (newTitle) {
                    await db
                      .update(schema.conversation)
                      .set({ title: newTitle })
                      .where(eq(schema.conversation.id, conv.id));
                    socket.emit('conversation.updated', { id: conv.id, title: newTitle });
                  }
                })
                .catch(() => {});
            }
          } catch (err) {
            const friendly = humanizeProviderError(err, model.provider, modelId);
            socket.emit('chat.error', { conversationId: conv.id, message: friendly });
          }
          return;
        }

        // ============ RAG (chat models só) ============
        let kbChunks: Array<{ chunkId: string; documentId: string; documentTitle: string; content: string }> = [];
        if (openaiKey && content.trim()) {
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
            console.warn('RAG falhou:', err instanceof Error ? err.message : err);
          }
        }

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

        const profileRows = await db
          .select({
            name: schema.user.name,
            department: schema.user.department,
            jobTitle: schema.user.jobTitle,
            writingStyle: schema.user.writingStyle,
            interests: schema.user.interests,
          })
          .from(schema.user)
          .where(eq(schema.user.id, socket.user.id))
          .limit(1);
        const profile = profileRows[0];

        const sysParts: string[] = [BASE_SYSTEM_PROMPT];
        if (profile) {
          const profileBits: string[] = [];
          if (profile.name) profileBits.push(`Nome: ${profile.name}`);
          if (profile.department && profile.department !== 'outros')
            profileBits.push(`Departamento: ${profile.department}`);
          if (profile.jobTitle) profileBits.push(`Cargo: ${profile.jobTitle}`);
          if (Array.isArray(profile.interests) && profile.interests.length > 0)
            profileBits.push(`Áreas de interesse: ${(profile.interests as any[]).join(', ')}`);
          if (profile.writingStyle)
            profileBits.push(`Estilo de escrita preferido: ${profile.writingStyle}`);
          if (profileBits.length > 0) {
            sysParts.push('## Sobre o usuário', profileBits.join('\n'));
          }
        }
        if (memoryRows.length > 0) {
          sysParts.push(
            '## Memórias sobre o usuário (use para personalizar, não force referências)',
            memoryRows
              .map((m, i) => `${i + 1}. ${m.content}${m.category ? ` (${m.category})` : ''}`)
              .join('\n')
          );
        }
        if (kbChunks.length > 0) {
          sysParts.push(
            '## Conhecimento institucional ENTUR (use SOMENTE se útil; cite com [Fonte: <título>])',
            kbChunks.map((c, i) => `### Fonte ${i + 1}: ${c.documentTitle}\n${c.content}`).join('\n\n')
          );
        }
        const systemPrompt = sysParts.join('\n\n');

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...previousFull.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            attachments: m.attachments || undefined,
          })),
          { role: 'user', content, attachments: attachments },
        ];

        let assistantText = '';
        let assistantThinking = '';
        const collectedImages: { mimeType: string; b64: string }[] = [];
        const collectedCitations: { url: string; title?: string }[] = [];
        const collectedTools: { tool: string; output?: string }[] = [];

        try {
          for await (const evt of streamChat({ modelId, messages, apiKey, tools })) {
            if (evt.type === 'delta') {
              assistantText += evt.text;
              socket.emit('chat.delta', { conversationId: conv.id, text: evt.text });
            } else if (evt.type === 'thinking') {
              assistantThinking += evt.text;
              socket.emit('chat.thinking', { conversationId: conv.id, text: evt.text });
            } else if (evt.type === 'image') {
              collectedImages.push({ mimeType: evt.mimeType, b64: evt.b64 });
              socket.emit('chat.image', {
                conversationId: conv.id,
                mimeType: evt.mimeType,
                b64: evt.b64,
              });
            } else if (evt.type === 'citation') {
              collectedCitations.push({ url: evt.url, title: evt.title });
              socket.emit('chat.citation', {
                conversationId: conv.id,
                url: evt.url,
                title: evt.title,
              });
            } else if (evt.type === 'tool_start') {
              collectedTools.push({ tool: evt.tool });
              socket.emit('chat.tool_start', { conversationId: conv.id, tool: evt.tool });
            } else if (evt.type === 'tool_result') {
              socket.emit('chat.tool_result', {
                conversationId: conv.id,
                tool: evt.tool,
                output: evt.output,
              });
            }
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

        // citations: web (collectedCitations) + RAG (kbChunks)
        const allCitations: any[] = [
          ...kbChunks.map((c) => ({
            kind: 'kb',
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            snippet: c.content.slice(0, 220),
          })),
          ...collectedCitations.map((c) => ({
            kind: 'web',
            url: c.url,
            documentTitle: c.title || c.url,
          })),
        ];

        // Estimativa de tokens (chars/4 em todo o input + output)
        const promptText = systemPrompt + previousFull.map((m: any) => m.content).join('\n') + content;
        const promptTokens = estimateTokens(promptText);
        const completionTokens = estimateTokens(assistantText) + estimateTokens(assistantThinking);
        const cost = chatCostCents(modelId, promptTokens, completionTokens);

        const [assistantMsg] = await db
          .insert(schema.message)
          .values({
            conversationId: conv.id,
            tenantId: TENANT_ID,
            role: 'assistant',
            content: assistantText,
            model: modelId,
            provider: model.provider,
            promptTokens,
            completionTokens,
            costCents: cost,
            thinking: assistantThinking || null,
            citations: allCitations.length > 0 ? (allCitations as any) : null,
            outputs: collectedImages.length > 0 ? ({ images: collectedImages } as any) : null,
            toolCalls: collectedTools.length > 0 ? (collectedTools as any) : null,
          })
          .returning();

        socket.emit('chat.done', {
          conversationId: conv.id,
          message: assistantMsg,
          citations: allCitations,
        });

        await db.insert(schema.usageLog).values({
          tenantId: TENANT_ID,
          userId: socket.user.id,
          conversationId: conv.id,
          messageId: assistantMsg.id,
          provider: model.provider,
          model: modelId,
          promptTokens,
          completionTokens,
          costCents: cost,
          latencyMs: Date.now() - startedAt,
        });

        // Background: titulo + memorias
        if (openaiKey) {
          if (isFirstExchange && conv.title === 'Nova conversa') {
            generateTitle({
              apiKey: openaiKey,
              userMessage: content,
              assistantReply: assistantText || '(resposta sem texto)',
            })
              .then(async (newTitle) => {
                if (newTitle) {
                  await db
                    .update(schema.conversation)
                    .set({ title: newTitle })
                    .where(eq(schema.conversation.id, conv.id));
                  socket.emit('conversation.updated', { id: conv.id, title: newTitle });
                }
              })
              .catch(() => {});
          }
          const userId = socket.user.id;
          extractMemories({
            apiKey: openaiKey,
            userMessage: content,
            assistantReply: assistantText,
            existingMemories: memoryRows.map((m) => m.content),
          })
            .then(async (extracted) => {
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
