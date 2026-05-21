import { useEffect, useRef, useState } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { API_BASE_URL } from '@/config';
import type { ArgumentLeaderboardResponse } from '@/app.model';

export interface UseArgumentLeaderboardReturn {
  data: ArgumentLeaderboardResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useArgumentLeaderboard(onLogout: () => void): UseArgumentLeaderboardReturn {
  const [data, setData] = useState<ArgumentLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    const abortController = new AbortController();

    const fetchArgumentLeaderboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
        const response = await fetch(`${API_BASE_URL}/dashboard/arguments`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (response.status === 401) {
          onLogoutRef.current();
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load argument leaderboard: ${response.statusText}`);
        }

        const json = (await response.json()) as ArgumentLeaderboardResponse;
        setData(json);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        setError(err instanceof Error ? err.message : 'Failed to load argument leaderboard');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchArgumentLeaderboard();

    return () => {
      abortController.abort();
    };
  }, []);

  return { data, isLoading, error };
}
