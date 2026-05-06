import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import type { Provider } from '@entur-ai/ai';

type Tab = 'profile' | 'keys';

interface Props {
  open: boolean;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onClose: () => void;
}

const PROVIDERS: { id: Provider; label: string; help: string; url: string }[] = [
  {
    id: 'openai',
    label: 'OpenAI · GPT, o4-mini',
    help: 'platform.openai.com/api-keys',
    url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic · Claude',
    help: 'console.anthropic.com/settings/keys',
    url: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    label: 'Google · Gemini',
    help: 'aistudio.google.com/apikey',
    url: 'https://aistudio.google.com/apikey',
  },
];

export function SettingsDialog({ open, tab, onTabChange, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg-surface border border-border-subtle rounded-xl shadow-elevated w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col animate-slide-in-up"
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

        <div className="flex border-b border-border-subtle">
          <TabBtn active={tab === 'keys'} onClick={() => onTabChange('keys')}>
            Chaves de IA
          </TabBtn>
          <TabBtn active={tab === 'profile'} onClick={() => onTabChange('profile')}>
            Perfil
          </TabBtn>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'keys' && <KeysTab />}
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
        'px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150',
        active
          ? 'border-accent-teal text-text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      )}
    >
      {children}
    </button>
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
        Cadastre as chaves uma vez. Elas ficam <strong>criptografadas</strong> no banco
        (AES-256-GCM) e são compartilhadas por toda a equipe ENTUR. Ninguém da equipe vê o valor —
        só o status.
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
                className="px-3 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-30 transition-colors"
              >
                Salvar
              </button>
              {s.configured && (
                <button
                  onClick={() => {
                    if (confirm(`Remover chave ${p.id}?`)) delMut.mutate({ provider: p.id });
                  }}
                  className="px-3 py-1.5 rounded-md border border-accent-danger/40 text-accent-danger hover:bg-accent-danger/10 text-sm transition-colors"
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
      <div className="text-xs text-text-tertiary mt-2">
        Edição de perfil chega em breve. Por enquanto, departamento e função são definidos pela
        Diretoria.
      </div>
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
