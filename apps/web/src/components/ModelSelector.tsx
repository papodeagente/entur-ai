import { useState, useRef, useEffect } from 'react';
import { MODELS, getModel, type Provider, type Capability } from '@entur-ai/ai';
import { cn } from '@/lib/cn';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
};

const PROVIDER_DOT: Record<Provider, string> = {
  openai: 'bg-emerald-500',
  anthropic: 'bg-orange-500',
  gemini: 'bg-blue-500',
};

const CAP_LABEL: Record<Capability, string> = {
  text: '',
  vision: '👁️',
  pdf: '📄',
  'image-gen': '🎨',
  'image-edit': '✏️',
  'web-search': '🔎',
  'code-exec': '🐍',
  thinking: '💭',
  reasoning: '🧠',
};

export function ModelSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const sections = [
    { key: 'openai-chat', title: 'OpenAI · Texto', list: MODELS.filter((m) => m.provider === 'openai' && m.kind === 'chat') },
    { key: 'openai-image', title: 'OpenAI · Imagem', list: MODELS.filter((m) => m.provider === 'openai' && m.kind === 'image') },
    { key: 'anthropic-chat', title: 'Anthropic', list: MODELS.filter((m) => m.provider === 'anthropic') },
    { key: 'gemini-chat', title: 'Google · Texto', list: MODELS.filter((m) => m.provider === 'gemini' && m.kind === 'chat') },
    { key: 'gemini-image', title: 'Google · Imagem', list: MODELS.filter((m) => m.provider === 'gemini' && m.kind === 'image') },
  ].filter((s) => s.list.length > 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md',
          'bg-bg-surface border border-border-subtle hover:bg-bg-elevated active:bg-border-subtle',
          'text-xs sm:text-sm font-medium transition-colors duration-150 min-h-[36px] max-w-[180px] sm:max-w-none'
        )}
        aria-label="Selecionar modelo"
      >
        {current && <span className={cn('w-2 h-2 rounded-full shrink-0', PROVIDER_DOT[current.provider])} />}
        <span className="truncate">{current?.label || 'Modelo'}</span>
        {current?.kind === 'image' && (
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary hidden sm:inline">img</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1.5 w-[min(20rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto z-50',
            'bg-bg-surface border border-border-subtle rounded-lg shadow-elevated',
            'animate-slide-in-up scrollbar-clean'
          )}
        >
          {sections.map((sec) => (
            <div key={sec.key}>
              <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-text-tertiary">
                {sec.title}
              </div>
              {sec.list.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-bg-elevated transition-colors duration-150',
                    m.id === value && 'bg-bg-elevated'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', PROVIDER_DOT[m.provider])} />
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.requiresBilling && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber border border-accent-amber/30">
                        $ billing
                      </span>
                    )}
                    {m.id === value && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="ml-auto text-accent-teal-hi"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary ml-4 mt-0.5">{m.description}</div>
                  <div className="ml-4 mt-1 flex flex-wrap gap-1">
                    {m.capabilities.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-tertiary border border-border-subtle"
                        title={c}
                      >
                        {CAP_LABEL[c]} {c}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
