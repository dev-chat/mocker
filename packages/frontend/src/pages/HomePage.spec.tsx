import { render, screen, waitFor } from '@testing-library/react';
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
  it('shows the Home heading', () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<HomePage onLogout={vi.fn()} />);
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
});
