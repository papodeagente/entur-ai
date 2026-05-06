import { cn } from '@/lib/cn';

const greeting = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
})();

const SUGGESTIONS = [
  {
    title: 'SPIN para venda em grupo',
    prompt: 'Crie 4 perguntas SPIN para qualificar um lead que tem interesse em organizar um pacote de viagem para um grupo de 25 pessoas.',
  },
  {
    title: 'Carrossel Papo de Agente',
    prompt: 'Escreva um carrossel de 6 slides para Instagram falando sobre os 3 maiores erros de quem está começando como agente de viagens.',
  },
  {
    title: 'Email de recuperação',
    prompt: 'Escreva um email curto, em pt-BR, para reativar um lead que abandonou a matrícula no curso há 2 semanas.',
  },
  {
    title: 'Devolutiva de mentoria',
    prompt: 'Crie um modelo de devolutiva de mentoria para uma aluna que está com dificuldade de fechar pacotes corporativos.',
  },
];

export function Welcome({ userName, onPick }: { userName: string; onPick: (p: string) => void }) {
  const firstName = userName.includes('@') ? userName.split('@')[0] : userName.split(' ')[0];

  return (
    <div className="flex flex-col items-center justify-center pt-20 animate-slide-in-up">
      <img src="/logo.png" alt="Entur" className="h-10 w-auto mb-8" />
      <h2 className="text-2xl font-semibold tracking-tighter2 mb-2">
        {greeting}, {firstName}
      </h2>
      <p className="text-sm text-text-tertiary mb-10">Como posso ajudar hoje?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.prompt)}
            className={cn(
              'text-left p-4 rounded-lg border border-border-subtle bg-bg-surface',
              'hover:bg-bg-elevated hover:border-border-strong',
              'transition-colors duration-150 ease-out-expo'
            )}
          >
            <div className="text-sm font-medium text-text-primary mb-1">{s.title}</div>
            <div className="text-xs text-text-tertiary line-clamp-2">{s.prompt}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
