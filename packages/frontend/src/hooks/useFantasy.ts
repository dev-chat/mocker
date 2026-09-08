import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import type { FantasyLandingResponse, FantasyOverview, SleeperUser } from '@/app.model';
import { API_BASE_URL } from '@/config';

interface UseFantasyReturn {
  landing: FantasyLandingResponse | null;
  overview: FantasyOverview | null;
  isLoading: boolean;
  error: string | null;
  selectedLeagueId: string | null;
  selectLeague: (leagueId: string) => void;
  linkSleeperUser: (usernameOrId: string) => Promise<void>;
}

export function useFantasy(onLogout: () => void): UseFantasyReturn {
  const [landing, setLanding] = useState<FantasyLandingResponse | null>(null);
  const [overview, setOverview] = useState<FantasyOverview | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [isLandingLoading, setIsLandingLoading] = useState(true);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const request = useCallback(async <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    if (response.status === 401) {
      onLogoutRef.current();
      throw new Error('Your session has expired.');
    }
    const body = (await response.json()) as T | { error?: string };
    if (!response.ok) {
      const message = typeof body === 'object' && body && 'error' in body ? body.error : undefined;
      throw new Error(message || `Request failed: ${response.statusText}`);
    }
    return body as T;
  }, []);

  const loadLanding = useCallback(async () => {
    setIsLandingLoading(true);
    setError(null);
    try {
      const data = await request<FantasyLandingResponse>('/fantasy');
      setLanding(data);
      setSelectedLeagueId((current) => current ?? data.leagues[0]?.league_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fantasy leagues.');
    } finally {
      setIsLandingLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadLanding();
  }, [loadLanding]);

  useEffect(() => {
    if (!selectedLeagueId) {
      setOverview(null);
      return;
    }
    let active = true;
    setIsOverviewLoading(true);
    setError(null);
    void request<FantasyOverview>(`/fantasy/leagues/${encodeURIComponent(selectedLeagueId)}`)
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load league.');
      })
      .finally(() => {
        if (active) setIsOverviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, selectedLeagueId]);

  const linkSleeperUser = useCallback(
    async (usernameOrId: string) => {
      setIsLandingLoading(true);
      setError(null);
      try {
        await request<SleeperUser>('/fantasy/profile', {
          method: 'PUT',
          body: JSON.stringify({ sleeperUser: usernameOrId }),
        });
        setOverview(null);
        setSelectedLeagueId(null);
        await loadLanding();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link Sleeper account.');
        setIsLandingLoading(false);
      }
    },
    [loadLanding, request],
  );

  return {
    landing,
    overview,
    isLoading: isLandingLoading || isOverviewLoading,
    error,
    selectedLeagueId,
    selectLeague: setSelectedLeagueId,
    linkSleeperUser,
  };
}
