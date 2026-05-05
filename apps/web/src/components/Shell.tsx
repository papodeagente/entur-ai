import { useState } from 'react';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/cn';

interface UserShape {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export function Shell({ user }: { user: UserShape }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen flex bg-bg-base text-text-primary">
      <aside
        className={cn(
          'shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col h-full',
          'transition-[width] duration-200 ease-out-expo',
          collapsed ? 'w-16' : 'w-[280px]'
        )}
      >
        <div className="px-4 py-4 flex items-center gap-2">
          {!collapsed ? (
            <img src="/logo.png" alt="Entur" className="h-7 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-accent-teal/10 flex items-center justify-center text-accent-teal-hi font-semibold text-sm">
              E
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-text-tertiary hover:text-text-primary p-1 rounded transition-colors duration-150"
            title={collapsed ? 'Expandir' : 'Recolher'}
            aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
        </div>

        <div className="px-3 mb-3">
          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md',
              'bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal-hi border border-accent-teal/20',
              'text-sm font-medium transition-colors duration-150 ease-out-expo'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Nova conversa</span>
                <kbd className="text-xs font-mono text-text-tertiary">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-clean px-3">
          {!collapsed && (
            <div className="text-xs text-text-tertiary uppercase tracking-wider px-2 mb-2 mt-4">
              Conversas
            </div>
          )}
          {!collapsed && (
            <div className="text-xs text-text-tertiary px-2 py-2">
              As conversas aparecerão aqui assim que o chat estiver ativo (Fase 2).
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle p-3">
          <button
            onClick={() => signOut()}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-2 rounded-md',
              'hover:bg-bg-elevated transition-colors duration-150',
              'text-left'
            )}
            title="Sair"
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
                <div className="text-xs text-text-tertiary truncate">{user.email}</div>
              </span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center px-6 border-b border-border-subtle">
          <h1 className="text-sm font-medium text-text-secondary tracking-tightish">
            ENTUR AI · Fundação
          </h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md animate-slide-in-up">
            <div className="text-text-secondary text-sm mb-3">Bem-vindo,</div>
            <h2 className="text-2xl font-semibold tracking-tighter2 mb-2">
              {user.name || user.email}
            </h2>
            <p className="text-sm text-text-tertiary leading-relaxed">
              Fundação concluída. O chat com IA, memória, RAG e biblioteca de prompts
              chegam nas próximas fases.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
