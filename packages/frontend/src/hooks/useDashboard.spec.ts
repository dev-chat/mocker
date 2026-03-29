import { renderHook, waitFor } from '@testing-library/react';
import { useDashboard } from '@/hooks/useDashboard';
import { AUTH_TOKEN_KEY } from '@/app.const';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockData = {
  myStats: { totalMessages: 10, rep: 5, avgSentiment: 0.5 },
  myActivity: [],
  myTopChannels: [],
  mySentimentTrend: [],
  leaderboard: [],
  repLeaderboard: [],
};

beforeEach(() => {
  localStorage.setItem(AUTH_TOKEN_KEY, 'test-token');
  mockFetch.mockReset();
});

describe('useDashboard', () => {
  it('starts in loading state with null data and no error', () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    const { result } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns data and clears loading state on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    const { result } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('calls onLogout when the response status is 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    renderHook(() => useDashboard(onLogout, 'weekly'));
    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('sets an error message when the response is not ok (non-401)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const { result } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/failed to load dashboard/i);
    expect(result.current.data).toBeNull();
  });

  it('sets a fallback error string for non-Error rejections', async () => {
    mockFetch.mockRejectedValue('network gone');
    const { result } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to load dashboard data');
  });

  it('ignores AbortErrors and does not set an error', async () => {
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValue(abortError);
    const { result } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('aborts the in-flight request on unmount without throwing', async () => {
    // Keep the fetch pending so the cleanup fires while it is in-flight.
    let resolveRequest!: (value: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => (resolveRequest = resolve)));
    const { unmount } = renderHook(() => useDashboard(vi.fn(), 'weekly'));
    unmount();
    // Resolve the promise after unmount to exercise the aborted finally branch.
    resolveRequest({ ok: true, status: 200, json: async () => mockData });
    // No assertion needed — the test verifies no error is thrown.
  });

  it('sends the auth token in the Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    renderHook(() => useDashboard(vi.fn(), 'weekly'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('includes the period as a query parameter in the fetch URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    renderHook(() => useDashboard(vi.fn(), 'monthly'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('period=monthly');
  });

  it('re-fetches when the period changes', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    let period = 'weekly' as 'weekly' | 'monthly';
    const { rerender } = renderHook(() => useDashboard(vi.fn(), period));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    period = 'monthly';
    rerender();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [secondUrl] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(secondUrl).toContain('period=monthly');
  });
});
