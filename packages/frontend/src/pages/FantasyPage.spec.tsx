import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FantasyPage } from '@/pages/FantasyPage';

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
  roster: {
    rosterId: 1,
    ownerName: 'Alice',
    players: [{ id: 'p1', name: 'Alex Receiver', position: 'WR', team: 'BUF', injuryStatus: null }],
    starters: ['p1'],
  },
  pendingTrades: [
    {
      transactionId: 'trade-1',
      createdAt: '2026-09-08T00:00:00.000Z',
      sides: [
        {
          rosterId: 1,
          ownerName: 'Alice',
          players: [{ id: 'p2', name: 'Blake Runner', position: 'RB', team: 'NYJ', injuryStatus: null }],
          draftPicks: [],
        },
      ],
      insight: 'This improves your running back depth.',
      recommendation: 'accept',
    },
  ],
  gamesToWatch: [
    {
      id: 'game-1',
      startsAt: '2026-09-10T00:00:00.000Z',
      status: 'Thu, 8:00 PM',
      broadcast: 'NBC',
      awayTeam: 'Buffalo Bills',
      homeTeam: 'New York Jets',
      rosterPlayers: [{ id: 'p1', name: 'Alex Receiver', position: 'WR', team: 'BUF', injuryStatus: null }],
    },
  ],
  tradeSuggestions: [
    {
      targetRosterId: 2,
      targetOwnerName: 'Bob',
      give: [{ id: 'p1', name: 'Alex Receiver', position: 'WR', team: 'BUF', injuryStatus: null }],
      receive: [{ id: 'p2', name: 'Blake Runner', position: 'RB', team: 'NYJ', injuryStatus: null }],
      rationale: 'Balances your lineup.',
      sleeperUrl: 'https://sleeper.com/leagues/999',
    },
  ],
  aiStatus: 'ready',
  sleeperUrl: 'https://sleeper.com/leagues/999',
};

describe('FantasyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  it('links a Sleeper account when no user is configured', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sleeperUser: null, leagues: [], season: '2026' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing.sleeperUser })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview });

    render(<FantasyPage onLogout={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/sleeper username/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/sleeper username/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/fantasy/profile'),
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ sleeperUser: 'alice' }) }),
      ),
    );
  });

  it('renders pending trades, games, AI insights, and actionable trade ideas', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview });

    render(<FantasyPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('This improves your running back depth.')).toBeInTheDocument());
    expect(screen.getByText('Buffalo Bills at New York Jets')).toBeInTheDocument();
    expect(screen.getByText('Balances your lineup.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /propose in sleeper/i })).toHaveAttribute(
      'href',
      'https://sleeper.com/leagues/999',
    );
  });
});
