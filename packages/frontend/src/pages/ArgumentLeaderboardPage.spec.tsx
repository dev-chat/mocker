import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ArgumentLeaderboardPage } from '@/pages/ArgumentLeaderboardPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const fullData = {
  leaderboard: [
    { name: 'Bob', slackId: 'U2', wins: 3, points: 12 },
    { name: 'Alice', slackId: 'U1', wins: 1, points: 4 },
  ],
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
    {
      id: 2,
      argument: 'vim vs emacs',
      participants: [
        { slackId: 'U3', name: 'Carol', viewpoint: 'vim is faster' },
        { slackId: 'U4', name: 'Dave', viewpoint: 'emacs is more flexible' },
      ],
      winner: { name: 'Carol', slackId: 'U3' },
      pointValue: 5,
      createdAt: '2026-05-20T00:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('ArgumentLeaderboardPage', () => {
  it('renders leaderboard standings and the default selected argument', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<ArgumentLeaderboardPage onLogout={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /argument leaderboard/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Top debaters')).toBeInTheDocument());
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.getAllByText('tabs vs spaces').length).toBeGreaterThan(0);
    expect(screen.getByText('spaces are clearer')).toBeInTheDocument();
  });

  it('switches the detailed outcome when a different argument is selected', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => fullData });
    render(<ArgumentLeaderboardPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('vim vs emacs')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /vim vs emacs/i }));
    expect(screen.getByText('emacs is more flexible')).toBeInTheDocument();
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no saved arguments', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ leaderboard: [], arguments: [] }) });
    render(<ArgumentLeaderboardPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/no arguments have been judged yet/i)).toBeInTheDocument());
    expect(screen.getByText(/no argument outcomes are available yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    render(<ArgumentLeaderboardPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/failed to load argument leaderboard/i)).toBeInTheDocument());
  });
});
