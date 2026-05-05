import { useSession } from './lib/auth-client';
import { Login } from './components/Login';
import { Shell } from './components/Shell';

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-base">
        <div className="text-text-tertiary text-sm animate-fade-in">Carregando…</div>
      </div>
    );
  }

  if (!session?.user) {
    return <Login />;
  }

  return <Shell user={session.user as any} />;
}
