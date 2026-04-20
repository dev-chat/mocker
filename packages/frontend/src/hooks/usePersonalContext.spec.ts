import { renderHook, waitFor } from '@testing-library/react';
import { usePersonalContext } from '@/hooks/usePersonalContext';
import { AUTH_TOKEN_KEY } from '@/app.const';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockData = {
  memories: [{ id: 1, content: 'Loves TypeScript', updatedAt: '2026-04-20T00:00:00.000Z' }],
  traits: [{ id: 2, content: 'Direct communicator', updatedAt: '2026-04-20T00:00:00.000Z' }],
};

beforeEach(() => {
  localStorage.setItem(AUTH_TOKEN_KEY, 'test-token');
  mockFetch.mockReset();
});

describe('usePersonalContext', () => {
  it('starts loading with null data and no error', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePersonalContext(vi.fn()));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns data on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    const { result } = renderHook(() => usePersonalContext(vi.fn()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('calls onLogout on 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    renderHook(() => usePersonalContext(onLogout));
    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('sets an error on non-401 failures', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const { result } = renderHook(() => usePersonalContext(vi.fn()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/failed to load personal context/i);
    expect(result.current.data).toBeNull();
  });

  it('uses fallback error for non-Error rejections', async () => {
    mockFetch.mockRejectedValue('broken');
    const { result } = renderHook(() => usePersonalContext(vi.fn()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to load personal context');
  });

  it('sends auth token in Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => mockData });
    renderHook(() => usePersonalContext(vi.fn()));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/dashboard/personal-context');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });
});
