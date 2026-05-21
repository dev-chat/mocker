import { renderHook, waitFor } from '@testing-library/react';
import { useArgumentLeaderboard } from '@/hooks/useArgumentLeaderboard';
import { AUTH_TOKEN_KEY } from '@/app.const';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockData = {
  leaderboard: [{ name: 'Bob', slackId: 'U2', wins: 3, points: 12 }],
  arguments: [
    {
      id: 1,
      argument: 'tabs vs spaces',
      participants: [
        { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
        { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
      ],
      winner: { name: 'Bob', slackId: 'U2' },
      pointValue: 4,
      createdAt: '2026-05-21T00:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  localStorage.setItem(AUTH_TOKEN_KEY, 'test-token');
  mockFetch.mockReset();
});

describe('useArgumentLeaderboard', () => {
  it('returns data and clears loading state on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    const { result } = renderHook(() => useArgumentLeaderboard(vi.fn()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('calls onLogout when the response status is 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    renderHook(() => useArgumentLeaderboard(onLogout));
    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('includes the auth token in the request headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    renderHook(() => useArgumentLeaderboard(vi.fn()));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/dashboard/arguments');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });
});
