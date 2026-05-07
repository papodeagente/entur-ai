import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import type { Provider } from '@entur-ai/ai';

type Tab = 'profile' | 'keys' | 'memories' | 'kb';

interface Props {
  open: boolean;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onClose: () => void;
}

const PROVIDERS: { id: Provider; label: string; help: string; url: string }[] = [
  { id: 'openai', label: 'OpenAI · GPT, o4-mini, embeddings', help: 'platform.openai.com/api-keys', url: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic · Claude', help: 'console.anthropic.com/settings/keys', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini', label: 'Google · Gemini', help: 'aistudio.google.com/apikey', url: 'https://aistudio.google.com/apikey' },
];

export function SettingsDialog({ open, tab, onTabChange, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg-surface border-0 sm:border sm:border-border-subtle sm:rounded-xl shadow-elevated w-full sm:max-w-2xl h-[100dvh] sm:max-h-[88vh] sm:h-auto overflow-hidden flex flex-col animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold tracking-tightish">Configurações</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-border-subtle overflow-x-auto">
          <TabBtn active={tab === 'memories'} onClick={() => onTabChange('memories')}>
            Memórias
          </TabBtn>
          <TabBtn active={tab === 'keys'} onClick={() => onTabChange('keys')}>
            Chaves de IA
          </TabBtn>
          <TabBtn active={tab === 'kb'} onClick={() => onTabChange('kb')}>
            Knowledge Base
          </TabBtn>
          <TabBtn active={tab === 'profile'} onClick={() => onTabChange('profile')}>
            Perfil
          </TabBtn>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {tab === 'memories' && <MemoriesTab />}
          {tab === 'keys' && <KeysTab />}
          {tab === 'kb' && <KbTab />}
          {tab === 'profile' && <ProfileTab />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap shrink-0',
        active
          ? 'border-accent-teal text-text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      )}
    >
      {children}
    </button>
  );
}

function MemoriesTab() {
  const utils = trpc.useUtils();
  const { data: items } = trpc.memories.list.useQuery();
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const createMut = trpc.memories.create.useMutation({
    onSuccess: () => {
      utils.memories.list.invalidate();
      toast.success('Memória adicionada');
    },
  });
  const updateMut = trpc.memories.update.useMutation({
    onSuccess: () => utils.memories.list.invalidate(),
  });
  const delMut = trpc.memories.delete.useMutation({
    onSuccess: () => utils.memories.list.invalidate(),
  });
  const clearMut = trpc.memories.clearAll.useMutation({
    onSuccess: () => {
      utils.memories.list.invalidate();
      toast.success('Todas memórias apagadas');
    },
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">
        O ENTUR AI aprende sobre você ao longo das conversas e salva fatos relevantes aqui.
        Esses fatos entram nas próximas conversas, criando continuidade. Tudo aqui é seu — só você
        vê e pode editar.
      </div>

      <div className="bg-bg-base border border-border-subtle rounded-lg p-3">
        <div className="text-xs text-text-tertiary mb-2">Adicionar manualmente:</div>
        <div className="flex gap-2">
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              newContent.trim() &&
              createMut.mutate({ content: newContent.trim() }) &&
              setNewContent('')
            }
            placeholder="Ex: prefiro respostas com bullets curtos"
            className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent-teal/50"
          />
          <button
            onClick={() => {
              if (!newContent.trim()) return;
              createMut.mutate({ content: newContent.trim() });
              setNewContent('');
            }}
            disabled={!newContent.trim() || createMut.isPending}
            className="px-3 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-30"
          >
            Adicionar
          </button>
        </div>
      </div>

      {!items && <div className="text-sm text-text-tertiary">Carregando…</div>}
      {items && items.length === 0 && (
        <div className="text-sm text-text-tertiary text-center py-6 bg-bg-base rounded-lg border border-border-subtle">
          Nenhuma memória ainda. Converse com o ENTUR AI que ele vai começar a aprender.
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-tertiary">{items.length} memória(s) salva(s)</div>
            <button
              onClick={() => confirm('Apagar TODAS as memórias?') && clearMut.mutate()}
              className="text-xs text-accent-danger hover:underline"
            >
              Apagar todas
            </button>
          </div>

          <ul className="space-y-1.5">
            {items.map((m) => (
              <li
                key={m.id}
                className="group flex items-start gap-2 p-3 rounded-lg border border-border-subtle bg-bg-base hover:bg-bg-elevated/60 transition-colors"
              >
                {editingId === m.id ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (editValue.trim()) updateMut.mutate({ id: m.id, content: editValue.trim() });
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editValue.trim()) updateMut.mutate({ id: m.id, content: editValue.trim() });
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 bg-bg-elevated border border-accent-teal/40 rounded-md px-2 py-1 text-sm"
                  />
                ) : (
                  <div className="flex-1 text-sm">
                    {m.category && (
                      <span className="text-[10px] uppercase tracking-wider bg-bg-elevated text-text-tertiary px-1.5 py-0.5 rounded mr-2">
                        {m.category}
                      </span>
                    )}
                    {m.content}
                    {m.source === 'auto_extract' && (
                      <span className="ml-2 text-[10px] text-text-tertiary">· auto</span>
                    )}
                  </div>
                )}
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingId(m.id);
                      setEditValue(m.content);
                    }}
                    className="text-xs text-text-tertiary hover:text-text-primary px-1.5"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => confirm('Excluir?') && delMut.mutate({ id: m.id })}
                    className="text-xs text-text-tertiary hover:text-accent-danger px-1.5"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function KeysTab() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.settings.apiKeys.useQuery();
  const setMut = trpc.settings.setApiKey.useMutation({
    onSuccess: () => {
      utils.settings.apiKeys.invalidate();
      toast.success('Chave salva');
    },
    onError: (e) => toast.error(e.message),
  });
  const delMut = trpc.settings.deleteApiKey.useMutation({
    onSuccess: () => {
      utils.settings.apiKeys.invalidate();
      toast.success('Chave removida');
    },
  });
  const [inputs, setInputs] = useState<Partial<Record<Provider, string>>>({});

  if (!status) return <div className="text-sm text-text-tertiary">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">
        Chaves criptografadas (AES-256-GCM) compartilhadas pela equipe ENTUR. A chave OpenAI também
        é usada para embeddings (RAG) e tarefas de fundo (auto-título, extração de memórias).
      </div>

      {PROVIDERS.map((p) => {
        const s = status[p.id];
        return (
          <div key={p.id} className="border border-border-subtle rounded-lg p-4 bg-bg-base">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  <a href={p.url} target="_blank" rel="noopener" className="underline hover:text-text-secondary">
                    {p.help}
                  </a>
                </div>
              </div>
              {s.configured ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-success/15 text-accent-success border border-accent-success/30">
                  ✓ Configurada
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-tertiary border border-border-strong">
                  Não configurada
                </span>
              )}
            </div>
            {s.configured && s.preview && (
              <div className="text-xs font-mono text-text-tertiary bg-bg-elevated rounded px-2 py-1 mb-2">
                {s.preview}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <input
                type="password"
                placeholder={s.configured ? 'Substituir chave…' : `Cole a chave ${p.id}`}
                value={inputs[p.id] || ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm font-mono outline-none focus:border-accent-teal/50"
              />
              <button
                onClick={() => {
                  const v = inputs[p.id]?.trim();
                  if (!v) return;
                  setMut.mutate({ provider: p.id, apiKey: v });
                  setInputs((prev) => ({ ...prev, [p.id]: '' }));
                }}
                disabled={setMut.isPending || !(inputs[p.id]?.trim())}
                className="px-3 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-30"
              >
                Salvar
              </button>
              {s.configured && (
                <button
                  onClick={() =>
                    confirm(`Remover chave ${p.id}?`) && delMut.mutate({ provider: p.id })
                  }
                  className="px-3 py-1.5 rounded-md border border-accent-danger/40 text-accent-danger hover:bg-accent-danger/10 text-sm"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KbTab() {
  const { data: me } = trpc.me.useQuery();
  const utils = trpc.useUtils();
  const { data: docs } = trpc.kb.list.useQuery();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');

  const uploadMut = trpc.kb.upload.useMutation({
    onSuccess: (r) => {
      utils.kb.list.invalidate();
      toast.success(`Indexado: ${r.chunksCreated} chunks`);
      setTitle('');
      setCategory('');
      setContent('');
    },
    onError: (e) => toast.error(e.message),
  });
  const delMut = trpc.kb.delete.useMutation({
    onSuccess: () => {
      utils.kb.list.invalidate();
      toast.success('Documento removido');
    },
  });

  const isAdmin = me?.role === 'admin' || me?.role === 'director';

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">
        Knowledge base institucional ENTUR. Documentos aqui ficam acessíveis ao ENTUR AI via RAG.
        O sistema busca automaticamente trechos relevantes da KB para enriquecer cada resposta.
      </div>

      {!isAdmin && (
        <div className="text-sm text-accent-amber bg-accent-amber/10 border border-accent-amber/30 rounded-lg p-3">
          Apenas Admin/Diretoria podem subir documentos. Você pode visualizar a base.
        </div>
      )}

      {isAdmin && (
        <div className="border border-border-subtle rounded-lg p-4 bg-bg-base space-y-3">
          <div className="text-sm font-medium">Subir documento</div>
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (ex: Playbook SPIN)"
              className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent-teal/50"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Categoria"
              className="w-40 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent-teal/50"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole o texto do documento (.md, .txt, manual). Mínimo 20 caracteres."
            rows={8}
            className="w-full bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-accent-teal/50"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                if (!title.trim() || content.trim().length < 20) return;
                uploadMut.mutate({
                  title: title.trim(),
                  content: content.trim(),
                  category: category.trim() || undefined,
                });
              }}
              disabled={uploadMut.isPending || !title.trim() || content.trim().length < 20}
              className="px-4 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-30"
            >
              {uploadMut.isPending ? 'Indexando…' : 'Indexar documento'}
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
          Documentos indexados ({docs?.length ?? 0})
        </div>
        {!docs && <div className="text-sm text-text-tertiary">Carregando…</div>}
        {docs && docs.length === 0 && (
          <div className="text-sm text-text-tertiary text-center py-6 bg-bg-base rounded-lg border border-border-subtle">
            Nenhum documento ainda.
          </div>
        )}
        <ul className="space-y-1.5">
          {docs?.map((d) => (
            <li
              key={d.id}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border-subtle bg-bg-base"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.title}</div>
                <div className="text-xs text-text-tertiary">
                  {d.category && <span className="mr-2">{d.category}</span>}
                  {d.totalChunks} chunks
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => confirm(`Remover "${d.title}"?`) && delMut.mutate({ id: d.id })}
                  className="opacity-0 group-hover:opacity-100 text-xs text-accent-danger hover:underline transition-opacity"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { data: me } = trpc.me.useQuery();
  if (!me) return <div className="text-sm text-text-tertiary">Carregando…</div>;
  return (
    <div className="space-y-3">
      <Field label="Email">
        <div className="px-3 py-2 bg-bg-elevated rounded-md text-sm font-mono text-text-secondary">
          {me.email}
        </div>
      </Field>
      <Field label="Departamento">
        <div className="px-3 py-2 bg-bg-elevated rounded-md text-sm text-text-secondary">
          {me.department}
        </div>
      </Field>
      <Field label="Função no sistema">
        <div className="px-3 py-2 bg-bg-elevated rounded-md text-sm text-text-secondary">
          {me.role}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
