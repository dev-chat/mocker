import { useState, useCallback, useEffect } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  authError: string | undefined;
  logout: (onLogout?: () => void) => void;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorFromUrl = urlParams.get('auth_error') ?? undefined;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const tokenFromHash = hashParams.get('token');

    if (tokenFromHash) {
      localStorage.setItem(AUTH_TOKEN_KEY, tokenFromHash);
      window.history.replaceState({}, '', window.location.pathname);
      setIsAuthenticated(true);
    } else if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      setIsAuthenticated(true);
    }

    if (errorFromUrl) {
      setAuthError(errorFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const logout = useCallback((onLogout?: () => void) => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
    setAuthError(undefined);
    onLogout?.();
  }, []);

  return { isAuthenticated, authError, logout };
}
