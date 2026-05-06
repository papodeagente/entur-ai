import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';

interface Variable {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea';
  default?: string;
}

interface Props {
  promptId: string | null;
  onClose: () => void;
  onUse: (renderedBody: string) => void;
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] || `[${key}]`);
}

export function PromptVariablesDialog({ promptId, onClose, onUse }: Props) {
  const { data: prompt } = trpc.prompts.get.useQuery(
    { id: promptId! },
    { enabled: !!promptId }
  );
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prompt) {
      const init: Record<string, string> = {};
      for (const v of (prompt.variables as Variable[]) || []) {
        init[v.name] = v.default || '';
      }
      setValues(init);
    }
  }, [prompt?.id]); // eslint-disable-line

  if (!promptId) return null;

  const variables = (prompt?.variables as Variable[]) || [];
  const rendered = prompt ? render(prompt.body, values) : '';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[55] flex items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg-surface border-0 sm:border sm:border-border-subtle sm:rounded-xl shadow-elevated w-full sm:max-w-3xl h-[100dvh] sm:max-h-[88vh] sm:h-auto overflow-hidden flex flex-col animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tightish truncate">
              {prompt?.title || 'Carregando…'}
            </h2>
            {prompt && (
              <div className="text-xs text-text-tertiary mt-0.5 capitalize">{prompt.category}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-text-tertiary">
              Preencher variáveis
            </div>
            {variables.length === 0 && (
              <div className="text-sm text-text-tertiary italic">
                Este prompt não tem variáveis. Pode usar direto.
              </div>
            )}
            {variables.map((v) => (
              <div key={v.name}>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {v.label}
                </label>
                {v.type === 'textarea' ? (
                  <textarea
                    value={values[v.name] || ''}
                    onChange={(e) => setValues((p) => ({ ...p, [v.name]: e.target.value }))}
                    placeholder={v.placeholder}
                    rows={3}
                    className="w-full bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-sm outline-none focus:border-accent-teal/50"
                  />
                ) : (
                  <input
                    value={values[v.name] || ''}
                    onChange={(e) => setValues((p) => ({ ...p, [v.name]: e.target.value }))}
                    placeholder={v.placeholder}
                    className="w-full bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent-teal/50"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-text-tertiary">
              Pré-visualização
            </div>
            <div
              className={cn(
                'bg-bg-base border border-border-subtle rounded-lg p-4 text-sm whitespace-pre-wrap',
                'font-mono leading-relaxed max-h-96 overflow-y-auto scrollbar-clean'
              )}
            >
              {rendered || '...'}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-border-subtle text-sm text-text-secondary hover:bg-bg-elevated"
          >
            Cancelar
          </button>
          <button
            onClick={() => onUse(rendered)}
            disabled={!prompt}
            className="px-4 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-30"
          >
            Usar no chat →
          </button>
        </div>
      </div>
    </div>
  );
}
