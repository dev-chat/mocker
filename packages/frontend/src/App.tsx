import { LoginPage } from '@/components/LoginPage';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';

export default function App() {
  const { isAuthenticated, isLoading, authError, logout } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage authError={authError} />;
  }

  return <AppShell onLogout={logout} />;
}
