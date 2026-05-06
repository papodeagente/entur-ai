import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onComplete: () => void;
}

const DEPTS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'mentoria', label: 'Mentoria' },
  { id: 'produto', label: 'Produto' },
  { id: 'suporte', label: 'Suporte' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'outros', label: 'Outros' },
] as const;

const STYLE_PRESETS = [
  { id: 'direto', label: 'Direto e objetivo', desc: 'Bullets curtos, sem rodeio' },
  { id: 'consultivo', label: 'Consultivo', desc: 'Explicar antes de prescrever' },
  { id: 'didatico', label: 'Didático', desc: 'Passo a passo + exemplos' },
  { id: 'storytelling', label: 'Storytelling', desc: 'Casos e narrativas' },
];

const INTERESTS_OPTIONS = [
  'Vendas em grupo (corporativo)',
  'Vendas individuais (B2C)',
  'Mentoria/educação',
  'Tom de voz Papo de Agente',
  'Carrosséis Instagram',
  'Reels e vídeo curto',
  'Email marketing',
  'Operacional/processos',
  'Atendimento ao aluno',
  'Análise de métricas',
  'SPIN Selling',
  'Negociação',
];

export function OnboardingDialog({ open, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [department, setDepartment] = useState<(typeof DEPTS)[number]['id']>('outros');
  const [jobTitle, setJobTitle] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const completeMut = trpc.profile.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success('Tudo certo! Vamos começar.');
      onComplete();
    },
  });
  const skipMut = trpc.profile.skipOnboarding.useMutation({
    onSuccess: () => onComplete(),
  });

  if (!open) return null;

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => {
    completeMut.mutate({
      department,
      jobTitle: jobTitle.trim() || undefined,
      writingStyle: writingStyle.trim() || undefined,
      interests,
    });
  };

  return (
    <div className="fixed inset-0 bg-bg-base z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Entur" className="h-10 w-auto" />
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-elevated p-8 animate-slide-in-up">
          <div className="flex gap-1 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 h-1 rounded-full transition-colors duration-200',
                  i <= step ? 'bg-accent-teal' : 'bg-border-subtle'
                )}
              />
            ))}
          </div>

          {step === 0 && (
            <div>
              <h2 className="text-2xl font-semibold tracking-tighter2 mb-2">
                Bem-vindo ao ENTUR AI
              </h2>
              <p className="text-text-secondary mb-6">
                Em 4 passos rápidos eu aprendo o suficiente para te ajudar como se já te
                conhecesse há anos. Pode pular se preferir.
              </p>
              <div className="bg-bg-base border border-border-subtle rounded-lg p-4 text-sm text-text-secondary">
                <div className="font-medium text-text-primary mb-2">O que vou usar:</div>
                <ul className="space-y-1.5 list-disc list-inside text-text-secondary">
                  <li>Seu departamento e cargo (para personalizar exemplos)</li>
                  <li>Seu estilo de escrita preferido (para responder no seu tom)</li>
                  <li>Suas áreas de interesse (para sugerir prompts relevantes)</li>
                </ul>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Onde você atua na ENTUR?</h2>
              <p className="text-text-secondary mb-6">
                Isso me ajuda a sugerir os prompts e exemplos mais úteis pra você.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {DEPTS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDepartment(d.id)}
                    className={cn(
                      'px-3 py-2 rounded-md border text-sm transition-colors duration-150',
                      department === d.id
                        ? 'bg-accent-teal/15 border-accent-teal/50 text-accent-teal-hi'
                        : 'bg-bg-base border-border-subtle hover:bg-bg-elevated'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1 mt-4">
                Cargo (opcional)
              </label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex: Coordenadora de vendas, Mentora de turma..."
                className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm outline-none focus:border-accent-teal/50"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Como você gosta de receber respostas?</h2>
              <p className="text-text-secondary mb-6">
                Vou usar isso como guia. Pode misturar — escolha um preset ou descreva do seu jeito.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {STYLE_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setWritingStyle(s.label + ' — ' + s.desc.toLowerCase())}
                    className={cn(
                      'text-left px-3 py-3 rounded-md border transition-colors duration-150',
                      writingStyle.startsWith(s.label)
                        ? 'bg-accent-teal/15 border-accent-teal/50'
                        : 'bg-bg-base border-border-subtle hover:bg-bg-elevated'
                    )}
                  >
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>

              <textarea
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                placeholder="Ou descreva: 'Direto, sem floreios, sempre com bullets, formato executivo...'"
                rows={3}
                className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm outline-none focus:border-accent-teal/50"
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Quais áreas mais te interessam?</h2>
              <p className="text-text-secondary mb-6">
                Marque tudo que faz sentido. Vou priorizar prompts e sugestões nessas áreas.
              </p>

              <div className="flex flex-wrap gap-2">
                {INTERESTS_OPTIONS.map((opt) => {
                  const active = interests.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() =>
                        setInterests((prev) =>
                          active ? prev.filter((x) => x !== opt) : [...prev, opt]
                        )
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-xs transition-colors duration-150',
                        active
                          ? 'bg-accent-teal/15 border-accent-teal/50 text-accent-teal-hi'
                          : 'bg-bg-base border-border-subtle hover:bg-bg-elevated'
                      )}
                    >
                      {active ? '✓ ' : ''}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => skipMut.mutate()}
              disabled={skipMut.isPending}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Pular tudo
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={back}
                  className="px-4 py-1.5 rounded-md border border-border-subtle text-sm hover:bg-bg-elevated"
                >
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={next}
                  className="px-4 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  onClick={finish}
                  disabled={completeMut.isPending}
                  className="px-4 py-1.5 rounded-md bg-accent-teal text-bg-base hover:bg-accent-teal-hi text-sm font-medium disabled:opacity-50"
                >
                  {completeMut.isPending ? 'Salvando…' : 'Vamos começar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
