import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { getModel } from '@entur-ai/ai';
import { CodeBlock, TableWrapper } from './CodeBlock';

interface Citation {
  kind?: 'kb' | 'web';
  documentId?: string;
  documentTitle?: string;
  snippet?: string;
  url?: string;
}

interface Attachment {
  kind: 'image' | 'pdf' | 'text';
  mimeType: string;
  data: string;
  name?: string;
}

interface ImageOutput {
  mimeType: string;
  b64: string;
}

interface ToolCall {
  tool: string;
  output?: string;
}

interface Props {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string | null;
    citations?: Citation[] | null;
    attachments?: Attachment[] | null;
    outputs?: { images?: ImageOutput[] } | null;
    thinking?: string | null;
    toolCalls?: ToolCall[] | null;
  };
  streaming?: boolean;
  liveImages?: ImageOutput[];
  liveTools?: ToolCall[];
  liveThinking?: string;
}

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Buscando na web',
  code_execution: 'Executando código',
  image_generation: 'Gerando imagem',
};

export function MessageBubble({ message, streaming, liveImages, liveTools, liveThinking }: Props) {
  const isUser = message.role === 'user';
  const model = message.model ? getModel(message.model) : null;
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const citations = message.citations || null;
  const attachments = message.attachments || null;
  const images = liveImages?.length ? liveImages : message.outputs?.images || null;
  const tools = liveTools?.length ? liveTools : message.toolCalls || null;
  const thinking = liveThinking || message.thinking || null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className={cn(
        'group flex w-full animate-fade-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'flex flex-col',
          isUser ? 'items-end max-w-[92%] sm:max-w-[85%]' : 'items-start w-full'
        )}
      >
        {!isUser && model && (
          <div className="text-xs text-text-tertiary mb-1.5 ml-9 sm:ml-9 sm:ml-11">{model.label}</div>
        )}

        {isUser && attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 justify-end">
            {attachments.map((a, i) => (
              <AttachmentPreview key={i} attachment={a} />
            ))}
          </div>
        )}

        {!isUser && tools && tools.length > 0 && (
          <div className="mb-2 ml-9 sm:ml-11 flex flex-wrap gap-1">
            {tools.map((t, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-tertiary border border-border-subtle"
              >
                🔧 {TOOL_LABELS[t.tool] || t.tool}
              </span>
            ))}
          </div>
        )}

        {!isUser && thinking && (
          <div className="mb-3 ml-9 sm:ml-11">
            <button
              onClick={() => setShowThinking((v) => !v)}
              className="text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-1"
            >
              <span>{showThinking ? '▼' : '▶'}</span>
              <span>💭 Raciocínio interno ({thinking.length} chars)</span>
            </button>
            {showThinking && (
              <div className="mt-2 p-3 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-secondary whitespace-pre-wrap font-mono">
                {thinking}
              </div>
            )}
          </div>
        )}

        <div className={cn('flex gap-3', isUser ? '' : 'w-full')}>
          {!isUser && (
            <div className="w-8 h-8 shrink-0 rounded-md bg-accent-teal/10 border border-accent-teal/20 flex items-center justify-center mt-0.5">
              <span className="w-2 h-2 rounded-full bg-accent-teal-hi" />
            </div>
          )}
          <div
            className={cn(
              isUser
                ? 'bg-bg-elevated px-4 py-2.5 rounded-lg text-text-primary'
                : 'flex-1 min-w-0 text-text-primary',
              'markdown-body',
              streaming && message.content && 'cursor-blink'
            )}
          >
            {isUser ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre: CodeBlock as any,
                  table: TableWrapper as any,
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {!isUser && images && images.length > 0 && (
          <div className="ml-9 sm:ml-11 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
            {images.map((img, i) => (
              <a
                key={i}
                href={`data:${img.mimeType};base64,${img.b64}`}
                download={`entur-ai-${Date.now()}-${i}.png`}
                className="block rounded-lg overflow-hidden border border-border-subtle hover:border-accent-teal/40 transition-colors"
                title="Clique para baixar"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.b64}`}
                  alt="Imagem gerada"
                  className="w-full h-auto"
                />
              </a>
            ))}
          </div>
        )}

        {!isUser && citations && citations.length > 0 && (
          <div className="ml-9 sm:ml-11 mt-3 border-t border-border-subtle pt-3 w-full max-w-2xl">
            <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
              Fontes consultadas
            </div>
            <ul className="space-y-1.5">
              {citations.map((c, i) => (
                <li key={i} className="text-xs flex items-start gap-2 text-text-secondary">
                  <span className="text-text-tertiary shrink-0 font-mono">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    {c.kind === 'web' && c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener"
                        className="text-accent-teal-hi hover:underline truncate block"
                      >
                        {c.documentTitle || c.url}
                      </a>
                    ) : (
                      <div className="font-medium text-text-primary truncate">
                        {c.documentTitle || 'Fonte ENTUR'}
                      </div>
                    )}
                    {c.snippet && (
                      <div className="text-text-tertiary line-clamp-2 mt-0.5">{c.snippet}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!streaming && message.content && (
          <div
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-1',
              isUser ? '' : 'ml-9 sm:ml-11'
            )}
          >
            <button
              onClick={copy}
              className="text-xs text-text-tertiary hover:text-text-primary px-2 py-0.5 rounded hover:bg-bg-elevated"
              title="Copiar"
            >
              {copied ? '✓ Copiado' : '⧉ Copiar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === 'image') {
    return (
      <img
        src={`data:${attachment.mimeType};base64,${attachment.data}`}
        alt={attachment.name || 'anexo'}
        className="max-w-[200px] max-h-[200px] rounded-lg border border-border-subtle"
      />
    );
  }
  return (
    <div className="px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-xs flex items-center gap-2">
      <span>📎</span>
      <span className="truncate max-w-[200px]">{attachment.name || attachment.kind}</span>
    </div>
  );
}
