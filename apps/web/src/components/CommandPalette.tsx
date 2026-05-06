import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { MODELS } from '@entur-ai/ai';

interface Action {
  id: string;
  label: string;
  hint?: string;
  group: 'Ações' | 'Prompts' | 'Modelos' | 'Conversas' | 'Configurações';
  icon?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onPickConversation: (id: string) => void;
  onPickPromptId: (id: string) => void;
  onSelectModel: (id: string) => void;
  onOpenSettings: (tab: 'memories' | 'keys' | 'kb' | 'profile') => void;
}

function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return 10 + (1 - q.length / t.length);
  // simple subsequence match
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

export function CommandPalette({
  open,
  onClose,
  onNewChat,
  onPickConversation,
  onPickPromptId,
  onSelectModel,
  onOpenSettings,
}: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: prompts } = trpc.prompts.list.useQuery(undefined, { enabled: open });
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, { enabled: open });

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const actions: Action[] = useMemo(() => {
    const acts: Action[] = [
      {
        id: 'new-chat',
        label: 'Nova conversa',
        hint: '⌘K',
        group: 'Ações',
        icon: '+',
        run: () => {
          onNewChat();
          onClose();
        },
      },
      {
        id: 'settings-memories',
        label: 'Abrir Memórias',
        group: 'Configurações',
        icon: '🧠',
        run: () => {
          onOpenSettings('memories');
          onClose();
        },
      },
      {
        id: 'settings-keys',
        label: 'Abrir Chaves de IA',
        group: 'Configurações',
        icon: '🔑',
        run: () => {
          onOpenSettings('keys');
          onClose();
        },
      },
      {
        id: 'settings-kb',
        label: 'Abrir Knowledge Base',
        group: 'Configurações',
        icon: '📚',
        run: () => {
          onOpenSettings('kb');
          onClose();
        },
      },
      {
        id: 'settings-profile',
        label: 'Editar Perfil',
        group: 'Configurações',
        icon: '👤',
        run: () => {
          onOpenSettings('profile');
          onClose();
        },
      },
    ];

    for (const m of MODELS) {
      acts.push({
        id: `model-${m.id}`,
        label: `Trocar para ${m.label}`,
        hint: m.kind === 'image' ? 'gera imagens' : m.provider,
        group: 'Modelos',
        icon: m.kind === 'image' ? '🎨' : '⚡',
        run: () => {
          onSelectModel(m.id);
          onClose();
        },
      });
    }

    if (prompts) {
      for (const p of prompts) {
        acts.push({
          id: `prompt-${p.id}`,
          label: p.title,
          hint: p.category,
          group: 'Prompts',
          icon: '📋',
          run: () => {
            onPickPromptId(p.id);
            onClose();
          },
        });
      }
    }

    if (conversations) {
      for (const c of conversations.slice(0, 30)) {
        acts.push({
          id: `conv-${c.id}`,
          label: c.title,
          hint: 'conversa',
          group: 'Conversas',
          icon: '💬',
          run: () => {
            onPickConversation(c.id);
            onClose();
          },
        });
      }
    }
    return acts;
  }, [prompts, conversations, onClose, onNewChat, onPickConversation, onPickPromptId, onSelectModel, onOpenSettings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    return actions
      .map((a) => ({ a, score: fuzzyScore(a.label + ' ' + (a.hint || ''), query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.a);
  }, [actions, query]);

  // grouped
  const grouped = useMemo(() => {
    const m: Record<string, Action[]> = {};
    for (const a of filtered) {
      if (!m[a.group]) m[a.group] = [];
      m[a.group].push(a);
    }
    return m;
  }, [filtered]);

  // garante cursor in-bounds
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0);
  }, [filtered.length]); // eslint-disable-line

  if (!open) return null;

  const flat = filtered;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-bg-surface border border-border-subtle rounded-xl shadow-elevated overflow-hidden animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-border-subtle">
          <span className="text-text-tertiary mr-3">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, flat.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                flat[cursor]?.run();
              }
            }}
            placeholder="Buscar comandos, prompts, conversas, modelos…"
            className="flex-1 bg-transparent outline-none py-3 text-sm placeholder:text-text-tertiary"
          />
          <kbd className="text-[10px] font-mono text-text-tertiary border border-border-subtle rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto scrollbar-clean">
          {flat.length === 0 ? (
            <div className="text-center py-10 text-sm text-text-tertiary">
              Nada encontrado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                  {group}
                </div>
                {items.map((a) => {
                  const idx = flat.indexOf(a);
                  return (
                    <button
                      key={a.id}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={a.run}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm flex items-center gap-3',
                        'transition-colors duration-100',
                        idx === cursor ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/60'
                      )}
                    >
                      {a.icon && (
                        <span className="text-base shrink-0 w-5 text-center">{a.icon}</span>
                      )}
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.hint && (
                        <span className="text-xs text-text-tertiary truncate">{a.hint}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border-subtle flex items-center justify-between text-[10px] text-text-tertiary">
          <span>
            <kbd className="font-mono mr-1">↑↓</kbd> navegar ·{' '}
            <kbd className="font-mono mr-1">⏎</kbd> selecionar
          </span>
          <span>{flat.length} resultados</span>
        </div>
      </div>
    </div>
  );
}
