import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
} from 'react';
import { trpc } from '@/lib/trpc';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/cn';
import { MessageBubble } from './MessageBubble';
import { Composer, type ComposerHandle, type PendingAttachment, type ToolFlags } from './Composer';
import { ModelSelector } from './ModelSelector';
import { Welcome } from './Welcome';
import { getModel, isImageModel } from '@entur-ai/ai';
import { toast } from 'sonner';

export interface ChatPaneHandle {
  insertText: (text: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  provider?: string | null;
  attachments?: any[] | null;
  outputs?: any | null;
  citations?: any[] | null;
  thinking?: string | null;
  toolCalls?: any[] | null;
  createdAt: string | Date;
}

interface ToolCall {
  tool: string;
  output?: string;
}

interface ImageOutput {
  mimeType: string;
  b64: string;
}

interface Citation {
  kind?: 'kb' | 'web';
  documentId?: string;
  documentTitle?: string;
  snippet?: string;
  url?: string;
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
  onOpenPalette: () => void;
  onOpenMobileSidebar: () => void;
}

export const ChatPane = forwardRef<ChatPaneHandle, Props>(function ChatPane(
  {
    activeId,
    modelId,
    setModelId,
    onCreateConversation,
    onActiveChanged,
    onMissingKey,
    userName,
    onOpenPalette,
    onOpenMobileSidebar,
  },
  forwardedRef
) {
  const composerRef = useRef<ComposerHandle | null>(null);

  useImperativeHandle(forwardedRef, () => ({
    insertText: (text: string) => composerRef.current?.insertText(text),
  }));
  const utils = trpc.useUtils();
  const { data: conv } = trpc.conversations.get.useQuery(
    { id: activeId! },
    { enabled: !!activeId }
  );

  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingImages, setStreamingImages] = useState<ImageOutput[]>([]);
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingTools, setStreamingTools] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ragSearching, setRagSearching] = useState(false);
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<Message | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingConvRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    const atBottom = distFromBottom < 80;
    setStickToBottom(atBottom);
    setShowScrollDown(!atBottom && distFromBottom > 240);
  }, []);

  useEffect(() => {
    if (conv?.model) setModelId(conv.model);
  }, [conv?.id]); // eslint-disable-line

  useEffect(() => {
    setOptimisticUserMsg(null);
    setStreamingText('');
    setStreamingThinking('');
    setStreamingImages([]);
    setStreamingCitations([]);
    setStreamingTools([]);
    setIsStreaming(false);
    setStickToBottom(true);
    // ao trocar de conversa, snap pro fim sem animação
    setTimeout(() => scrollToBottom('auto'), 0);
  }, [activeId, scrollToBottom]);

  useEffect(() => {
    const socket = getSocket();

    const onUserMessage = (payload: any) => {
      if (payload.conversationId === streamingConvRef.current) {
        setOptimisticUserMsg(payload.message);
      }
    };
    const onConvUpdated = (payload: any) => {
      utils.conversations.list.invalidate();
      if (payload.id === streamingConvRef.current)
        utils.conversations.get.invalidate({ id: payload.id });
    };
    const onStart = () => {
      setStreamingText('');
      setStreamingThinking('');
      setStreamingImages([]);
      setStreamingCitations([]);
      setStreamingTools([]);
      setIsStreaming(true);
    };
    const onRagSearching = () => setRagSearching(true);
    const onDelta = (p: any) => {
      if (p.conversationId === streamingConvRef.current) setStreamingText((s) => s + p.text);
    };
    const onThinking = (p: any) => {
      if (p.conversationId === streamingConvRef.current)
        setStreamingThinking((s) => s + p.text);
    };
    const onImage = (p: any) => {
      if (p.conversationId === streamingConvRef.current)
        setStreamingImages((arr) => [...arr, { mimeType: p.mimeType, b64: p.b64 }]);
    };
    const onCitation = (p: any) => {
      if (p.conversationId === streamingConvRef.current)
        setStreamingCitations((arr) => [...arr, { kind: 'web', url: p.url, documentTitle: p.title }]);
    };
    const onToolStart = (p: any) => {
      if (p.conversationId === streamingConvRef.current)
        setStreamingTools((arr) => [...arr, { tool: p.tool }]);
    };
    const onDone = (payload: any) => {
      setIsStreaming(false);
      setRagSearching(false);
      setStreamingText('');
      setStreamingThinking('');
      setStreamingImages([]);
      setStreamingCitations([]);
      setStreamingTools([]);
      streamingConvRef.current = null;
      setOptimisticUserMsg(null);
      utils.conversations.get.invalidate({ id: payload.conversationId });
      utils.conversations.list.invalidate();
    };
    const onError = (payload: any) => {
      setIsStreaming(false);
      setRagSearching(false);
      setStreamingText('');
      setStreamingThinking('');
      setStreamingImages([]);
      setStreamingCitations([]);
      setStreamingTools([]);
      streamingConvRef.current = null;
      setOptimisticUserMsg(null);
      const msg = payload.message || 'Erro ao gerar resposta';
      toast.error(msg, { duration: 8000 });
      if (msg.toLowerCase().includes('chave')) onMissingKey();
    };
    const onMemoryAdded = (p: any) => {
      utils.memories.list.invalidate();
      toast.success('💡 Nova memória salva', {
        description: p.memory?.content?.slice(0, 100),
        duration: 4000,
      });
    };

    socket.on('chat.user_message', onUserMessage);
    socket.on('chat.start', onStart);
    socket.on('chat.rag_searching', onRagSearching);
    socket.on('chat.delta', onDelta);
    socket.on('chat.thinking', onThinking);
    socket.on('chat.image', onImage);
    socket.on('chat.citation', onCitation);
    socket.on('chat.tool_start', onToolStart);
    socket.on('chat.done', onDone);
    socket.on('chat.error', onError);
    socket.on('conversation.updated', onConvUpdated);
    socket.on('memory.added', onMemoryAdded);

    return () => {
      socket.off('chat.user_message', onUserMessage);
      socket.off('chat.start', onStart);
      socket.off('chat.rag_searching', onRagSearching);
      socket.off('chat.delta', onDelta);
      socket.off('chat.thinking', onThinking);
      socket.off('chat.image', onImage);
      socket.off('chat.citation', onCitation);
      socket.off('chat.tool_start', onToolStart);
      socket.off('chat.done', onDone);
      socket.off('chat.error', onError);
      socket.off('conversation.updated', onConvUpdated);
      socket.off('memory.added', onMemoryAdded);
    };
  }, [utils, onMissingKey]);

  useEffect(() => {
    if (stickToBottom) scrollToBottom('smooth');
  }, [
    conv?.messages?.length,
    streamingText,
    streamingImages.length,
    optimisticUserMsg,
    stickToBottom,
    scrollToBottom,
  ]);

  const send = useCallback(
    async (text: string, attachments: PendingAttachment[], tools: ToolFlags) => {
      if ((!text.trim() && attachments.length === 0) || isStreaming) return;
      let convId = activeId;
      if (!convId) {
        convId = await onCreateConversation(text || 'Nova imagem');
        onActiveChanged(convId);
      }
      streamingConvRef.current = convId;

      setOptimisticUserMsg({
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        attachments: attachments.length ? attachments : null,
        createdAt: new Date().toISOString(),
      });

      const socket = getSocket();
      socket.emit(
        'chat.send',
        { conversationId: convId, content: text, modelId, attachments, tools },
        (resp: any) => {
          if (resp && !resp.ok) {
            toast.error(resp.message || resp.error || 'Falha ao enviar');
            setOptimisticUserMsg(null);
            streamingConvRef.current = null;
            if (resp.error === 'missing_api_key') onMissingKey();
          }
        }
      );
    },
    [activeId, modelId, isStreaming, onCreateConversation, onActiveChanged, onMissingKey]
  );

  const messages: Message[] = (conv?.messages as any) || [];
  const showWelcome = !activeId && !optimisticUserMsg && !isStreaming;
  const isImage = isImageModel(modelId);

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
      <header className="h-14 flex items-center px-3 md:px-6 border-b border-border-subtle gap-2 md:gap-3 shrink-0">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden text-text-tertiary hover:text-text-primary p-2 -ml-1 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Abrir navegação"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h1 className="text-sm font-medium text-text-primary tracking-tightish truncate">
            {conv?.title || 'Nova conversa'}
          </h1>
        </div>
        <button
          onClick={onOpenPalette}
          className="hidden md:flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary border border-border-subtle bg-bg-elevated/40 hover:bg-bg-elevated rounded-md px-3 py-1.5 transition-colors"
          title="Abrir paleta de comandos"
        >
          <span>📋 Prompts</span>
          <kbd className="font-mono text-[10px]">⌘K</kbd>
        </button>
        <ModelSelector value={modelId} onChange={setModelId} />
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto scrollbar-clean overscroll-contain relative"
      >
        <div className="max-w-3xl xl:max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
          {showWelcome ? (
            <Welcome userName={userName} onPick={(p) => send(p, [], { webSearch: false, codeExec: false, thinking: false })} />
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {optimisticUserMsg && !messages.find((m) => m.id === optimisticUserMsg.id) && (
                <MessageBubble key="optimistic" message={optimisticUserMsg} />
              )}
              {isStreaming && (streamingText || streamingImages.length > 0 || streamingThinking) && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingText,
                    model: modelId,
                    citations: streamingCitations,
                    createdAt: new Date().toISOString(),
                  }}
                  streaming
                  liveImages={streamingImages}
                  liveTools={streamingTools}
                  liveThinking={streamingThinking}
                />
              )}
              {isStreaming &&
                !streamingText &&
                streamingImages.length === 0 &&
                !streamingThinking && (
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
                    <span>
                      {isImage
                        ? 'Gerando imagem…'
                        : ragSearching
                        ? 'Consultando knowledge base ENTUR…'
                        : streamingTools.length > 0
                        ? `${streamingTools[streamingTools.length - 1].tool}…`
                        : `${getModel(modelId)?.label} está pensando…`}
                    </span>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border-subtle bg-bg-base shrink-0 relative">
        {/* Botão "voltar ao fim" flutuante */}
        {showScrollDown && (
          <button
            onClick={() => {
              setStickToBottom(true);
              scrollToBottom('smooth');
            }}
            className={cn(
              'absolute -top-12 left-1/2 -translate-x-1/2 z-10',
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'bg-bg-elevated border border-border-strong text-text-secondary',
              'hover:bg-bg-surface hover:text-text-primary',
              'shadow-elevated text-xs font-medium',
              'transition-all duration-200 ease-out-expo',
              'animate-fade-in'
            )}
            aria-label="Ir para a última mensagem"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M19 14l-7 7-7-7M19 5l-7 7-7-7" />
            </svg>
            Ir para o fim
          </button>
        )}

        <div className="max-w-3xl xl:max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <Composer ref={composerRef} onSend={send} disabled={isStreaming} modelId={modelId} />
        </div>
      </div>
    </main>
  );
});
