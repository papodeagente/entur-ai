import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatCents(cents: number): string {
  if (cents === 0) return '$0,00';
  return `$${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function AdminPanel({ open, onClose }: Props) {
  const [days, setDays] = useState(30);
  const { data: me } = trpc.profile.getMine.useQuery(undefined, { enabled: open });
  const isAuthorized = me?.role === 'admin' || me?.role === 'director';
  const { data: stats, isLoading } = trpc.admin.overview.useQuery(
    { days },
    { enabled: open && isAuthorized }
  );

  if (!open) return null;

  // calc max para barras simples
  const maxByDay = Math.max(1, ...(stats?.byDay?.map((d) => d.requests) ?? [1]));
  const maxByModel = Math.max(1, ...(stats?.byModel?.map((m) => m.requests) ?? [1]));

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg-surface border border-border-subtle rounded-xl shadow-elevated w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h2 className="text-base font-semibold tracking-tightish">Painel da Diretoria</h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Uso, custo estimado e atividade da equipe ENTUR
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-bg-elevated border border-border-subtle rounded-md px-2 py-1.5 text-xs"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={180}>Últimos 6 meses</option>
            </select>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary p-1 rounded"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-clean p-6 space-y-6">
          {!isAuthorized && (
            <div className="text-sm bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-lg p-4">
              Acesso restrito à Diretoria/Admin. Sua função atual é{' '}
              <strong>{me?.role}</strong>.
            </div>
          )}

          {isAuthorized && isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg border border-border-subtle bg-bg-elevated animate-pulse"
                />
              ))}
            </div>
          )}

          {isAuthorized && stats && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Requisições" value={formatNumber(stats.totals.requests)} />
                <Kpi
                  label="Custo estimado"
                  value={formatCents(stats.totals.costCents)}
                  hint="USD"
                  accent
                />
                <Kpi label="Usuários ativos" value={formatNumber(stats.totals.activeUsers)} />
                <Kpi
                  label="Tokens (in/out)"
                  value={`${formatNumber(stats.totals.promptTokens)} / ${formatNumber(
                    stats.totals.completionTokens
                  )}`}
                />
              </div>

              {/* Por dia (barras simples) */}
              <Section title="Volume por dia">
                {stats.byDay.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="flex items-end gap-1 h-32 px-1">
                    {stats.byDay.map((d) => (
                      <div
                        key={d.day}
                        className="flex-1 min-w-0 flex flex-col items-center gap-1"
                        title={`${d.day}: ${d.requests} req · ${formatCents(d.cost_cents)}`}
                      >
                        <div
                          className="w-full bg-accent-teal/40 rounded-sm hover:bg-accent-teal-hi transition-colors"
                          style={{
                            height: `${Math.max(2, (d.requests / maxByDay) * 100)}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-text-tertiary mt-1 font-mono">
                  <span>{stats.byDay[0]?.day || '–'}</span>
                  <span>{stats.byDay[stats.byDay.length - 1]?.day || '–'}</span>
                </div>
              </Section>

              {/* Modelos mais usados */}
              <Section title="Modelos mais usados">
                {stats.byModel.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="space-y-1.5">
                    {stats.byModel.slice(0, 8).map((m) => (
                      <div key={m.model + m.provider} className="flex items-center gap-3">
                        <div className="w-44 shrink-0 text-xs">
                          <div className="font-medium truncate">{m.model}</div>
                          <div className="text-text-tertiary text-[10px]">{m.provider}</div>
                        </div>
                        <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-teal/70"
                            style={{ width: `${(m.requests / maxByModel) * 100}%` }}
                          />
                        </div>
                        <div className="w-20 shrink-0 text-xs text-right tabular-nums">
                          {formatNumber(m.requests)}
                        </div>
                        <div className="w-20 shrink-0 text-xs text-right tabular-nums text-accent-amber">
                          {formatCents(m.cost_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Por departamento */}
              <Section title="Engajamento por departamento">
                {stats.byDept.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stats.byDept.map((d) => (
                      <div
                        key={d.department}
                        className="bg-bg-base border border-border-subtle rounded-md p-3"
                      >
                        <div className="text-xs uppercase tracking-wider text-text-tertiary">
                          {d.department}
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {formatNumber(d.requests)}
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                          {formatCents(d.cost_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Top users */}
              <Section title="Usuários mais ativos">
                {stats.byUser.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="space-y-1">
                    {stats.byUser.map((u) => (
                      <div
                        key={u.user_id}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-elevated/50"
                      >
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="font-medium truncate">{u.name || u.email}</div>
                          <div className="text-text-tertiary truncate">
                            {u.email} · {u.department}
                          </div>
                        </div>
                        <div className="w-20 text-xs text-right tabular-nums shrink-0">
                          {formatNumber(u.requests)} req
                        </div>
                        <div className="w-20 text-xs text-right tabular-nums shrink-0 text-accent-amber">
                          {formatCents(u.cost_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Erros recentes */}
              {stats.totals.errors > 0 && (
                <Section title={`Erros recentes (${stats.totals.errors} no período)`}>
                  <div className="space-y-1">
                    {stats.recentErrors.slice(0, 8).map((e) => (
                      <div
                        key={e.id}
                        className="text-xs px-3 py-2 rounded-md bg-accent-danger/10 border border-accent-danger/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-text-tertiary">
                            {new Date(e.createdAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="font-medium">{e.model}</span>
                        </div>
                        <div className="text-accent-danger mt-1 line-clamp-2">{e.error}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg-base border border-border-subtle rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-text-tertiary">{label}</div>
      <div
        className={cn(
          'text-xl font-semibold tabular-nums tracking-tightish mt-1',
          accent && 'text-accent-teal-hi'
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-text-tertiary mt-0.5">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-text-tertiary mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <div className="text-sm text-text-tertiary text-center py-6 bg-bg-base rounded-md border border-border-subtle">
      Sem dados ainda no período.
    </div>
  );
}
