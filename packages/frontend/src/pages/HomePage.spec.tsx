import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HomePage } from '@/pages/HomePage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const fullData = {
  myStats: { totalMessages: 42, rep: 10, avgSentiment: 0.75 },
  myActivity: [
    { date: '2024-01-01', count: 5 },
    { date: '2024-01-02', count: 3 },
  ],
  myTopChannels: [
    { channel: 'general', count: 10 },
    { channel: 'random', count: 7 },
  ],
  mySentimentTrend: [
    { weekStart: '2024-01-01', avgSentiment: 0.5 },
    { weekStart: '2024-01-08', avgSentiment: 0.8 },
  ],
  leaderboard: [
    { name: 'alice', count: 100 },
    { name: 'bob', count: 80 },
  ],
  repLeaderboard: [
    { name: 'alice', rep: 50 },
    { name: 'bob', rep: 30 },
  ],
};

const emptyData = {
  myStats: { totalMessages: 0, rep: 0, avgSentiment: null },
  myActivity: [],
  myTopChannels: [],
  mySentimentTrend: [],
  leaderboard: [],
  repLeaderboard: [],
};

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
});

describe('HomePage', () => {
  it('shows the Home heading', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: /^home$/i })).toBeInTheDocument();
  });

  it('shows loading placeholders initially', () => {
    // Keep fetch pending so loading state persists throughout the test.
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<HomePage onLogout={vi.fn()} />);
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('renders stats after data is loaded', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('+0.75')).toBeInTheDocument();
  });

  it('renders chart sections after data is loaded', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('My Message Activity')).toBeInTheDocument());
    expect(screen.getByText('My Top Channels')).toBeInTheDocument();
    expect(screen.getByText('My Sentiment Trend')).toBeInTheDocument();
    expect(screen.getByText('Most Active Members')).toBeInTheDocument();
    expect(screen.getByText('Reputation Standings')).toBeInTheDocument();
  });

  it('shows "no data" empty states when all arrays are empty', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => emptyData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('No activity data available yet.')).toBeInTheDocument());
    expect(screen.getByText('No channel data available yet.')).toBeInTheDocument();
    expect(screen.getByText('No sentiment data available yet.')).toBeInTheDocument();
    expect(screen.getByText('No leaderboard data available yet.')).toBeInTheDocument();
    expect(screen.getByText('No reputation data available yet.')).toBeInTheDocument();
  });

  it('shows "—" for null sentiment in the stat card', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => emptyData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => {
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  it('shows a negative sentiment value with a minus sign', async () => {
    const data = {
      ...fullData,
      myStats: { totalMessages: 5, rep: -3, avgSentiment: -0.5 },
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => data });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('-0.50')).toBeInTheDocument());
  });

  it('shows an error banner when the fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument());
  });

  it('calls onLogout when the fetch returns 401', async () => {
    const onLogout = vi.fn();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    render(<HomePage onLogout={onLogout} />);
    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  });

  it('renders all five period selector buttons with Weekly active by default', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    for (const label of ['Daily', 'Weekly', 'Monthly', 'Yearly', 'All Time']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to Monthly period and re-fetches when the Monthly button is clicked', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('period=monthly');
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses "the last 24 hours" in descriptions when Daily is selected', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText(/the last 24 hours/).length).toBeGreaterThan(0);
    const [url] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('period=daily');
  });

  it('uses "the last 365 days" in descriptions when Yearly is selected', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText(/the last 365 days/).length).toBeGreaterThan(0);
    const [url] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('period=yearly');
  });

  it('uses "all time" in descriptions when All Time is selected', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText(/all time/).length).toBeGreaterThan(0);
    const [url] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('period=allTime');
  });

  it('shows zero sentiment as neutral (no plus or minus prefix)', async () => {
    const data = { ...fullData, myStats: { totalMessages: 1, rep: 0, avgSentiment: 0 } };
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => data });
    render(<HomePage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('0.00')).toBeInTheDocument());
  });
});
