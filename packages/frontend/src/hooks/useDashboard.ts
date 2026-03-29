import { useState, useEffect, useRef } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { API_BASE_URL } from '@/config';
import type { DashboardResponse, TimePeriod } from '@/app.model';

export interface UseDashboardReturn {
  data: DashboardResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useDashboard(onLogout: () => void, period: TimePeriod): UseDashboardReturn {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    const abortController = new AbortController();

    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
        const response = await fetch(`${API_BASE_URL}/dashboard?period=${encodeURIComponent(period)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (response.status === 401) {
          onLogoutRef.current();
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load dashboard: ${response.statusText}`);
        }

        const json = (await response.json()) as DashboardResponse;
        setData(json);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchDashboard();

    return () => {
      abortController.abort();
    };
  }, [period]);

  return { data, isLoading, error };
}
