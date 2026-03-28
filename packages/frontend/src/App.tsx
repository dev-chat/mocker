import { LoginPage } from '@/components/LoginPage';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';

export default function App() {
  const { isAuthenticated, authError, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage authError={authError} />;
  }

  return <AppShell onLogout={logout} />;
}
