import { useEffect, useRef, useState } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { API_BASE_URL } from '@/config';
import type { PersonalContextResponse } from '@/app.model';

export interface UsePersonalContextReturn {
  data: PersonalContextResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function usePersonalContext(onLogout: () => void): UsePersonalContextReturn {
  const [data, setData] = useState<PersonalContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    const abortController = new AbortController();

    const fetchPersonalContext = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
        const response = await fetch(`${API_BASE_URL}/dashboard/personal-context`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (response.status === 401) {
          onLogoutRef.current();
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load personal context: ${response.statusText}`);
        }

        const json = (await response.json()) as PersonalContextResponse;
        setData(json);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        setError(err instanceof Error ? err.message : 'Failed to load personal context');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchPersonalContext();

    return () => {
      abortController.abort();
    };
  }, []);

  return { data, isLoading, error };
}
