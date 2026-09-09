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
  waiverSuggestions: [
    {
      add: { id: 'p3', name: 'Casey Waiver', position: 'WR', team: 'DAL', injuryStatus: null },
      drop: { id: 'p1', name: 'Alex Receiver', position: 'WR', team: 'BUF', injuryStatus: null },
      rationale: 'Adds more weekly upside.',
      priority: 'high',
      recommendedBid: 17,
      sleeperUrl: 'https://sleeper.com/leagues/999',
    },
  ],
  lineupRecommendation: {
    week: 1,
    opponentOwnerName: 'Bob',
    recommendedStarters: [
      {
        id: 'p3',
        name: 'Casey Waiver',
        position: 'WR',
        team: 'DAL',
        injuryStatus: null,
        fantasyPositions: ['WR'],
        projectedPoints: 18.4,
      },
    ],
    start: [],
    sit: [],
    userPotential: { min: 8.2, max: 18.4 },
    opponentPotential: { min: 9.1, max: 16.7 },
    summary: 'This lineup gives you the strongest overall projection against Bob.',
  },
  lineupStatus: 'ready',
  teamHealth: {
    percentage: 82,
    rating: 'good',
    summary: 'Strong starters and balanced depth make this roster a contender.',
  },
  aiStatus: 'ready',
  sleeperUrl: 'https://sleeper.com/leagues/999',
};

describe('FantasyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  it('does not offer account linking when no Sleeper user is configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sleeperUser: null, leagues: [], season: '2026' }),
    });

    render(<FantasyPage onLogout={vi.fn()} />);
    expect(await screen.findByText(/no sleeper account linked/i)).toBeInTheDocument();
    expect(screen.getByText(/ownership can be verified/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('renders pending trades, games, AI insights, and actionable trade ideas', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview });

    render(<FantasyPage onLogout={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('This improves your running back depth.')).toBeInTheDocument());
    expect(screen.getByText('Buffalo Bills at New York Jets')).toBeInTheDocument();
    expect(screen.getByText('Balances your lineup.')).toBeInTheDocument();
    expect(screen.getByText('Adds more weekly upside.')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('Strong starters and balanced depth make this roster a contender.')).toBeInTheDocument();
    expect(screen.getByText('$17')).toBeInTheDocument();
    expect(screen.getByText('Best projected lineup vs. Bob')).toBeInTheDocument();
    expect(screen.getByText('8.2–18.4')).toBeInTheDocument();
    expect(screen.getByText('9.1–16.7')).toBeInTheDocument();
    expect(screen.getByText(/waivers process wednesday and sunday/i)).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent?.trim());
    expect(headings.indexOf('Trade ideas')).toBeLessThan(headings.indexOf('Games to watch'));
    expect(headings.indexOf('Waiver wire proposals')).toBeLessThan(headings.indexOf('Games to watch'));
    expect(screen.getByRole('link', { name: /propose in sleeper/i })).toHaveAttribute(
      'href',
      'https://sleeper.com/leagues/999',
    );
  });

  it('renders unavailable analysis and empty league insights', async () => {
    const emptyOverview = {
      ...overview,
      roster: { ...overview.roster, players: [] },
      pendingTrades: [],
      gamesToWatch: [],
      tradeSuggestions: [],
      waiverSuggestions: [],
      teamHealth: null,
      aiStatus: 'unavailable',
      lineupRecommendation: null,
      lineupStatus: 'no_matchup',
    };
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyOverview });

    render(<FantasyPage onLogout={vi.fn()} />);

    expect(await screen.findByText(/AI trade analysis is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/there are no pending trades/i)).toBeInTheDocument();
    expect(screen.getByText(/no strong trade opportunities/i)).toBeInTheDocument();
    expect(screen.getByText(/no strong waiver claims/i)).toBeInTheDocument();
    expect(screen.getByText(/no scheduled games/i)).toBeInTheDocument();
    expect(screen.getByText('0 rostered players')).toBeInTheDocument();
  });

  it('refreshes lineup, AI trade, and waiver recommendations', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => landing })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => overview });

    render(<FantasyPage onLogout={vi.fn()} />);
    await screen.findByText('Balances your lineup.');

    fireEvent.click(screen.getByRole('button', { name: /refresh lineup/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(mockFetch.mock.calls[2]?.[0]).toMatch(/\/fantasy\/leagues\/999\?refresh=true/);

    fireEvent.click(screen.getByRole('button', { name: /refresh ideas/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    expect(mockFetch.mock.calls[3]?.[0]).toMatch(/\/fantasy\/leagues\/999\?refresh=true/);

    fireEvent.click(screen.getByRole('button', { name: /refresh proposals/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(5));
    expect(mockFetch.mock.calls[4]?.[0]).toMatch(/\/fantasy\/leagues\/999\?refresh=true/);
  });
});
