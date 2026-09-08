import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { useFantasy } from '@/hooks/useFantasy';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const landing = {
  sleeperUser: { user_id: '123', username: 'alice', display_name: 'Alice', avatar: null },
  leagues: [
    {
      league_id: '999',
      name: 'Friends League',
      season: '2026',
      status: 'in_season',
      avatar: null,
      total_rosters: 10,
    },
  ],
  season: '2026',
};

const overview = {
  league: landing.leagues[0],
  roster: { rosterId: 1, ownerName: 'Alice', players: [], starters: [] },
  pendingTrades: [],
  pendingWaivers: [],
  gamesToWatch: [],
  tradeSuggestions: [],
  waiverSuggestions: [],
  teamHealth: null,
  aiStatus: 'ready',
  sleeperUrl: 'https://sleeper.com/leagues/999',
};

describe('useFantasy', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(AUTH_TOKEN_KEY, 'token');
    mockFetch.mockReset();
  });

  it('loads leagues and the first league overview', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview });

    const { result } = renderHook(() => useFantasy(vi.fn()));

    await waitFor(() => expect(result.current.overview).toEqual(overview));
    expect(result.current.selectedLeagueId).toBe('999');
    expect(result.current.isLoading).toBe(false);
  });

  it('logs out and surfaces expired sessions on 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' }),
    });

    const { result } = renderHook(() => useFantasy(onLogout));

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
    expect(result.current.error).toBe('Your session has expired.');
  });

  it('uses API error messages for unsuccessful requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ error: 'Sleeper is unavailable.' }),
    });

    const { result } = renderHook(() => useFantasy(vi.fn()));

    await waitFor(() => expect(result.current.error).toBe('Sleeper is unavailable.'));
  });

  it('surfaces league overview failures', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing }).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({}),
    });

    const { result } = renderHook(() => useFantasy(vi.fn()));

    await waitFor(() => expect(result.current.error).toBe('Request failed: Bad Gateway'));
    expect(result.current.isLoading).toBe(false);
  });

  it('loads another selected league', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...overview, league: { ...overview.league, league_id: '888' } }),
      });

    const { result } = renderHook(() => useFantasy(vi.fn()));
    await waitFor(() => expect(result.current.overview).toEqual(overview));

    act(() => result.current.selectLeague('888'));

    await waitFor(() => expect(result.current.overview?.league.league_id).toBe('888'));
  });

  it('surfaces account-linking failures and leaves loading state', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sleeperUser: null, leagues: [], season: '2026' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Sleeper user was not found.' }),
      });

    const { result } = renderHook(() => useFantasy(vi.fn()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.linkSleeperUser('missing'));

    expect(result.current.error).toBe('Sleeper user was not found.');
    expect(result.current.isLoading).toBe(false);
  });
});
