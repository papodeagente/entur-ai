import { useMemo, useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { groupConversationsByDate } from '@/lib/format';
import { SidebarSkeleton } from './Skeleton';

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ activeId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: conversations } = trpc.conversations.list.useQuery();
  const renameMut = trpc.conversations.rename.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const togglePinMut = trpc.conversations.togglePin.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const deleteMut = trpc.conversations.delete.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = search.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => groupConversationsByDate(filtered as any), [filtered]);

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      renameMut.mutate({ id: editingId, title: editValue.trim() });
    }
    setEditingId(null);
  };

  return (
    <>
      <div className="px-3 pb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversas…"
          className={cn(
            'w-full text-base sm:text-sm bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 sm:py-1.5',
            'outline-none focus:border-accent-teal/50 transition-colors duration-150'
          )}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-clean overscroll-contain px-2 pb-3" aria-label="Lista de conversas">
        {!conversations && <SidebarSkeleton />}
        {conversations && filtered.length === 0 && (
          <div className="text-xs text-text-tertiary px-2 py-2">
            {search ? 'Nada encontrado.' : 'Nenhuma conversa ainda.'}
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="text-xs text-text-tertiary uppercase tracking-wider px-2 py-1.5">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((c: any) => (
                <li
                  key={c.id}
                  className={cn(
                    'group flex items-center rounded-md transition-colors duration-150',
                    activeId === c.id ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/60'
                  )}
                >
                  {editingId === c.id ? (
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-bg-base border border-accent-teal/40 rounded-md px-2 py-1.5 text-sm mx-1"
                    />
                  ) : (
                    <button
                      onClick={() => onSelect(c.id)}
                      onDoubleClick={() => {
                        setEditingId(c.id);
                        setEditValue(c.title);
                      }}
                      className="flex-1 text-left px-3 py-2 text-sm truncate flex items-center gap-1.5 min-w-0"
                      title={c.title + ' (duplo-clique p/ renomear)'}
                    >
                      {c.pinned && <span className="text-xs">📌</span>}
                      <span className="truncate">{c.title}</span>
                    </button>
                  )}
                  {editingId !== c.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinMut.mutate({ id: c.id, pinned: !c.pinned });
                        }}
                        title={c.pinned ? 'Desafixar' : 'Fixar'}
                        className="text-text-tertiary hover:text-accent-amber px-1.5 py-2"
                      >
                        {c.pinned ? '📍' : '📌'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Excluir "${c.title}"?`)) deleteMut.mutate({ id: c.id });
                        }}
                        title="Excluir"
                        className="text-text-tertiary hover:text-accent-danger px-1.5 py-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
