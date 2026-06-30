import { useState, useCallback, useEffect } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { API_BASE_URL } from '@/config';
import { createAuthenticatedRequestInit } from '@/lib/authFetch';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | undefined;
  logout: (onLogout?: () => void) => void;
}

// Lazy initializer: reads the token from the URL hash or localStorage once at mount.
// localStorage.setItem is called here (before the first render) when a hash token is found.
function readInitialAuthState(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const tokenFromHash = hashParams.get('token');
  if (tokenFromHash) {
    localStorage.setItem(AUTH_TOKEN_KEY, tokenFromHash);
  }
  return !!tokenFromHash || !!localStorage.getItem(AUTH_TOKEN_KEY);
}

// Lazy initializer: reads the auth_error query param once at mount.
function readInitialAuthError(): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('auth_error') ?? undefined;
}

export function useAuth(): UseAuthReturn {
  const initialAuthState = readInitialAuthState();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthState);
  const [isLoading, setIsLoading] = useState(!initialAuthState);
  const [authError, setAuthError] = useState<string | undefined>(readInitialAuthError);

  // Side effects only: clean up the URL after reading the token / error from it.
  // No setState calls here — initial state is already set via the lazy initializers above.
  useEffect(() => {
    if (window.location.hash || window.location.search.includes('auth_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (initialAuthState) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me`, createAuthenticatedRequestInit());
        if (!cancelled) {
          setIsAuthenticated(response.ok);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAuthState]);

  const logout = useCallback((onLogout?: () => void) => {
    void fetch(`${API_BASE_URL}/auth/logout`, createAuthenticatedRequestInit({ method: 'POST' })).catch(
      () => undefined,
    );
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
    setIsLoading(false);
    setAuthError(undefined);
    onLogout?.();
  }, []);

  return { isAuthenticated, isLoading, authError, logout };
}
