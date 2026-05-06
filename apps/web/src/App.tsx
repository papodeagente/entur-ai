import { useSession } from './lib/auth-client';
import { Login } from './components/Login';
import { Shell } from './components/Shell';

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-3 animate-fade-in" role="status" aria-live="polite">
          <img src="/logo.png" alt="ENTUR" className="h-8 w-auto opacity-60" />
          <div className="flex gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" />
            <span
              className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
          <span className="sr-only">Carregando</span>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <Login />;
  }

  return <Shell user={session.user as any} />;
}
