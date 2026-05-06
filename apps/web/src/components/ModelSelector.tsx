import { useState, useRef, useEffect } from 'react';
import { MODELS, getModel, type Provider } from '@entur-ai/ai';
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

  const grouped: Record<Provider, typeof MODELS> = {
    openai: [],
    anthropic: [],
    gemini: [],
  };
  for (const m of MODELS) grouped[m.provider].push(m);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md',
          'bg-bg-surface border border-border-subtle hover:bg-bg-elevated',
          'text-sm font-medium transition-colors duration-150'
        )}
      >
        {current && <span className={cn('w-2 h-2 rounded-full', PROVIDER_DOT[current.provider])} />}
        <span>{current?.label || 'Selecionar modelo'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1.5 w-72 z-50',
            'bg-bg-surface border border-border-subtle rounded-lg shadow-elevated overflow-hidden',
            'animate-slide-in-up'
          )}
        >
          {(Object.keys(grouped) as Provider[]).map((p) => (
            <div key={p}>
              <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-text-tertiary">
                {PROVIDER_LABEL[p]}
              </div>
              {grouped[p].map((m) => (
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
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
