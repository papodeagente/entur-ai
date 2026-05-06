import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { getModel } from '@entur-ai/ai';

interface Citation {
  documentId: string;
  documentTitle: string;
  snippet?: string;
}

interface Props {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string | null;
    citations?: Citation[] | null;
  };
  streaming?: boolean;
}

export function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  const model = message.model ? getModel(message.model) : null;
  const [copied, setCopied] = useState(false);
  const citations = (message.citations as Citation[] | null) || null;

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
      <div className={cn('flex flex-col max-w-[80%]', isUser ? 'items-end' : 'items-start w-full')}>
        {!isUser && model && (
          <div className="text-xs text-text-tertiary mb-1.5 ml-11">{model.label}</div>
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
              streaming && 'cursor-blink'
            )}
          >
            {isUser ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content || ''}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {!isUser && citations && citations.length > 0 && (
          <div className="ml-11 mt-3 border-t border-border-subtle pt-3 w-full max-w-2xl">
            <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
              Fontes ENTUR consultadas
            </div>
            <ul className="space-y-1.5">
              {citations.map((c, i) => (
                <li
                  key={c.documentId + '-' + i}
                  className="text-xs flex items-start gap-2 text-text-secondary"
                >
                  <span className="text-text-tertiary shrink-0 font-mono">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary truncate">{c.documentTitle}</div>
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
              isUser ? '' : 'ml-11'
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
