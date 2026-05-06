import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import { Sidebar } from './Sidebar';
import { ChatPane, type ChatPaneHandle } from './ChatPane';
import { trpc } from '@/lib/trpc';
import { DEFAULT_MODEL_ID } from '@entur-ai/ai';

// Lazy-loaded dialogs (não fazem parte do bundle inicial)
const SettingsDialog = lazy(() =>
  import('./SettingsDialog').then((m) => ({ default: m.SettingsDialog }))
);
const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const PromptVariablesDialog = lazy(() =>
  import('./PromptVariablesDialog').then((m) => ({ default: m.PromptVariablesDialog }))
);
const OnboardingDialog = lazy(() =>
  import('./OnboardingDialog').then((m) => ({ default: m.OnboardingDialog }))
);
const AdminPanel = lazy(() =>
  import('./AdminPanel').then((m) => ({ default: m.AdminPanel }))
);

interface UserShape {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export function Shell({ user }: { user: UserShape }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [settingsOpen, setSettingsOpen] = useState<
    'profile' | 'keys' | 'memories' | 'kb' | null
  >(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const chatRef = useRef<ChatPaneHandle | null>(null);

  const utils = trpc.useUtils();
  const { data: profile } = trpc.profile.getMine.useQuery();
  const createConv = trpc.conversations.create.useMutation({
    onSuccess: (conv) => {
      utils.conversations.list.invalidate();
      setActiveId(conv.id);
    },
  });

  const newChat = useCallback(() => setActiveId(null), []);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (cmd && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newChat();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newChat]);

  const showOnboarding = !!profile && profile.onboarded === false;

  return (
    <div className="h-screen flex bg-bg-base text-text-primary">
      <a
        href="#chat-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-accent-teal focus:text-bg-base focus:px-3 focus:py-1.5 focus:rounded-md focus:text-sm"
      >
        Pular para o chat
      </a>

      <aside
        className={cn(
          'shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col h-full',
          'transition-[width] duration-200 ease-out-expo',
          collapsed ? 'w-16' : 'w-[280px]'
        )}
        aria-label="Navegação lateral"
      >
        <div className="px-4 py-4 flex items-center gap-2">
          {!collapsed ? (
            <img src="/logo.png" alt="ENTUR" className="h-7 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-accent-teal/10 flex items-center justify-center text-accent-teal-hi font-semibold text-sm">
              E
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-text-tertiary hover:text-text-primary p-1 rounded transition-colors duration-150"
            aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        <div className="px-3 mb-2 space-y-1.5">
          <button
            onClick={newChat}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md',
              'bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal-hi border border-accent-teal/20',
              'text-sm font-medium transition-colors duration-150 ease-out-expo'
            )}
            aria-label="Nova conversa"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Nova conversa</span>
                <kbd className="text-xs font-mono text-text-tertiary">⌘⇧N</kbd>
              </>
            )}
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-md',
              'border border-border-subtle bg-bg-elevated/40 hover:bg-bg-elevated',
              'text-sm transition-colors duration-150'
            )}
            aria-label="Buscar comandos e prompts"
          >
            <span className="text-text-tertiary" aria-hidden="true">⌘</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-text-secondary">Buscar comandos…</span>
                <kbd className="text-xs font-mono text-text-tertiary">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {!collapsed && <Sidebar activeId={activeId} onSelect={setActiveId} />}

        <div className="border-t border-border-subtle p-3 space-y-1">
          {!collapsed && (
            <>
              <button
                onClick={() => setSettingsOpen('memories')}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
              >
                Memórias
              </button>
              <button
                onClick={() => setSettingsOpen('kb')}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
              >
                Knowledge Base
              </button>
              <button
                onClick={() => setSettingsOpen('keys')}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
              >
                Chaves de IA
              </button>
              {isAdmin && (
                <button
                  onClick={() => setAdminOpen(true)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-accent-amber hover:bg-bg-elevated transition-colors"
                >
                  Painel da Diretoria
                </button>
              )}
            </>
          )}
          <button
            onClick={() => signOut()}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-2 rounded-md',
              'hover:bg-bg-elevated transition-colors duration-150 text-left'
            )}
            aria-label="Sair"
          >
            {user.image ? (
              <img src={user.image} alt="" className="w-7 h-7 rounded-full shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-accent-teal/15 text-accent-teal-hi font-semibold text-xs flex items-center justify-center shrink-0">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
            )}
            {!collapsed && (
              <span className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">{user.name || user.email}</div>
                <div className="text-xs text-text-tertiary truncate">
                  {profile?.department && profile.department !== 'outros'
                    ? profile.department
                    : 'Sair'}
                </div>
              </span>
            )}
          </button>
        </div>
      </aside>

      <div id="chat-main" className="flex-1 flex flex-col min-w-0">
        <ChatPane
          ref={chatRef}
          activeId={activeId}
          modelId={modelId}
          setModelId={setModelId}
          onNewChat={newChat}
          onCreateConversation={async (firstMessage) => {
            const created = await createConv.mutateAsync({
              title: firstMessage.slice(0, 60) || 'Nova conversa',
              model: modelId,
            });
            return created.id;
          }}
          onActiveChanged={setActiveId}
          onMissingKey={() => setSettingsOpen('keys')}
          userName={user.name || user.email}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </div>

      <Suspense fallback={null}>
        {settingsOpen !== null && (
          <SettingsDialog
            open={settingsOpen !== null}
            tab={settingsOpen || 'memories'}
            onTabChange={(t) => setSettingsOpen(t)}
            onClose={() => setSettingsOpen(null)}
          />
        )}
        {paletteOpen && (
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNewChat={newChat}
            onPickConversation={setActiveId}
            onPickPromptId={(id) => setActivePromptId(id)}
            onSelectModel={setModelId}
            onOpenSettings={(t) => setSettingsOpen(t)}
          />
        )}
        {activePromptId && (
          <PromptVariablesDialog
            promptId={activePromptId}
            onClose={() => setActivePromptId(null)}
            onUse={(rendered) => {
              setActivePromptId(null);
              chatRef.current?.insertText(rendered);
            }}
          />
        )}
        {showOnboarding && (
          <OnboardingDialog
            open={showOnboarding}
            onComplete={() => utils.profile.getMine.invalidate()}
          />
        )}
        {adminOpen && (
          <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}
