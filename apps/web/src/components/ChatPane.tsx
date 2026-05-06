import { useEffect, useRef, useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/cn';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { ModelSelector } from './ModelSelector';
import { Welcome } from './Welcome';
import { getModel } from '@entur-ai/ai';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  provider?: string | null;
  createdAt: string | Date;
}

interface Props {
  activeId: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  onNewChat: () => void;
  onCreateConversation: (firstMessage: string) => Promise<string>;
  onActiveChanged: (id: string) => void;
  onMissingKey: () => void;
  userName: string;
}

export function ChatPane({
  activeId,
  modelId,
  setModelId,
  onNewChat,
  onCreateConversation,
  onActiveChanged,
  onMissingKey,
  userName,
}: Props) {
  const utils = trpc.useUtils();
  const { data: conv } = trpc.conversations.get.useQuery(
    { id: activeId! },
    { enabled: !!activeId }
  );

  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingConvRef = useRef<string | null>(null);

  // sync model with conversation's last model
  useEffect(() => {
    if (conv?.model) setModelId(conv.model);
  }, [conv?.id]); // eslint-disable-line

  // limpar optimistic ao trocar conversa
  useEffect(() => {
    setOptimisticMessages([]);
    setStreamingText('');
    setIsStreaming(false);
  }, [activeId]);

  // socket listeners
  useEffect(() => {
    const socket = getSocket();

    const onUserMessage = (payload: any) => {
      // Adiciona a user message persistida (servidor confirma com ID)
      if (payload.conversationId === streamingConvRef.current) {
        setOptimisticMessages((prev) => {
          const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
          return [...withoutTemp, payload.message];
        });
      }
    };

    const onConvUpdated = (payload: any) => {
      utils.conversations.list.invalidate();
      if (payload.id === streamingConvRef.current) {
        utils.conversations.get.invalidate({ id: payload.id });
      }
    };

    const onStart = () => {
      setStreamingText('');
      setIsStreaming(true);
    };

    const onDelta = (payload: any) => {
      if (payload.conversationId === streamingConvRef.current) {
        setStreamingText((s) => s + payload.text);
      }
    };

    const onDone = (payload: any) => {
      setIsStreaming(false);
      setStreamingText('');
      streamingConvRef.current = null;
      setOptimisticMessages([]);
      utils.conversations.get.invalidate({ id: payload.conversationId });
      utils.conversations.list.invalidate();
    };

    const onError = (payload: any) => {
      setIsStreaming(false);
      setStreamingText('');
      streamingConvRef.current = null;
      setOptimisticMessages([]);
      const msg = payload.message || 'Erro ao gerar resposta';
      toast.error(msg);
      if (msg.includes('API') || msg.toLowerCase().includes('chave')) onMissingKey();
    };

    socket.on('chat.user_message', onUserMessage);
    socket.on('chat.start', onStart);
    socket.on('chat.delta', onDelta);
    socket.on('chat.done', onDone);
    socket.on('chat.error', onError);
    socket.on('conversation.updated', onConvUpdated);

    return () => {
      socket.off('chat.user_message', onUserMessage);
      socket.off('chat.start', onStart);
      socket.off('chat.delta', onDelta);
      socket.off('chat.done', onDone);
      socket.off('chat.error', onError);
      socket.off('conversation.updated', onConvUpdated);
    };
  }, [utils, onMissingKey]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [conv?.messages?.length, optimisticMessages.length, streamingText]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      let convId = activeId;
      if (!convId) {
        convId = await onCreateConversation(text);
        onActiveChanged(convId);
      }
      streamingConvRef.current = convId;
      // optimistic user message
      setOptimisticMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);

      const socket = getSocket();
      socket.emit(
        'chat.send',
        { conversationId: convId, content: text, modelId },
        (resp: any) => {
          if (resp && !resp.ok) {
            toast.error(resp.message || resp.error || 'Falha ao enviar');
            setOptimisticMessages([]);
            streamingConvRef.current = null;
            if (resp.error === 'missing_api_key') onMissingKey();
          }
        }
      );
    },
    [activeId, modelId, isStreaming, onCreateConversation, onActiveChanged, onMissingKey]
  );

  const allMessages: Message[] = [
    ...(conv?.messages?.map((m: any) => ({
      ...m,
      createdAt:
        typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
    })) || []),
    ...optimisticMessages.filter(
      (om) => !conv?.messages?.find((m: any) => m.content === om.content && m.role === om.role)
    ),
  ];

  const showWelcome = !activeId && optimisticMessages.length === 0 && !isStreaming;

  return (
    <main className="flex-1 flex flex-col min-w-0">
      <header className="h-14 flex items-center justify-between px-6 border-b border-border-subtle">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium text-text-primary tracking-tightish truncate">
            {conv?.title || 'Nova conversa'}
          </h1>
        </div>
        <ModelSelector value={modelId} onChange={setModelId} />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-clean">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {showWelcome ? (
            <Welcome userName={userName} onPick={(p) => send(p)} />
          ) : (
            <>
              {allMessages.map((m, i) => (
                <MessageBubble key={m.id || i} message={m} />
              ))}
              {isStreaming && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingText,
                    model: modelId,
                    createdAt: new Date().toISOString(),
                  }}
                  streaming
                />
              )}
              {isStreaming && !streamingText && (
                <div className="text-xs text-text-tertiary flex items-center gap-2 pl-11">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </span>
                  <span>{getModel(modelId)?.label} está pensando…</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border-subtle bg-bg-base">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Composer onSend={send} disabled={isStreaming} />
        </div>
      </div>
    </main>
  );
}
