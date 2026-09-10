import Axios from 'axios';
import { getRepository } from 'typeorm';
import type { OpenAIClientLike } from '../lib/resilientOpenAIClient';
import type {
  AITradeAnalysis,
  FantasyPlayer,
  FantasyTeam,
  LineupRecommendation,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  SleeperProjection,
  SleeperTransaction,
  WaiverBidGuidance,
} from './fantasy.model';
import { FantasyService } from './fantasy.service';

vi.mock('axios');
vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return { ...actual, getRepository: vi.fn() };
});

const aiResponse = {
  output: [
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({
            teamHealth: {
              percentage: 82,
              summary: 'Strong starters and balanced depth make this roster a contender.',
            },
            tradeInsights: [
              {
                transactionId: 'trade-1',
                insight: 'The incoming receiver adds weekly upside.',
                recommendation: 'accept',
              },
            ],
            suggestions: [
              {
                targetRosterId: 2,
                givePlayerIds: ['p1'],
                receivePlayerIds: ['p2'],
                rationale: 'Adds depth at running back.',
              },
            ],
            waiverSuggestions: [
              {
                addPlayerId: 'p3',
                dropPlayerId: 'p1',
                rationale: 'Adds a higher-upside waiver option.',
                priority: 'high',
                recommendedBid: 17,
              },
            ],
            lineupSummary: 'Start Drew Runner to maximize your matchup ceiling this week.',
          }),
        },
      ],
    },
  ],
};

type FantasyServiceInternals = {
  getTradeAnalysis: (
    key: string,
    refresh: boolean,
    generate: () => Promise<AITradeAnalysis>,
  ) => Promise<AITradeAnalysis>;
  buildLineupRecommendation: (
    week: number,
    league: SleeperLeague,
    ownRoster: FantasyTeam,
    teams: FantasyTeam[],
    matchups: SleeperMatchup[],
    projections: SleeperProjection[],
  ) => LineupRecommendation | null;
  buildLineupFallbackSummary: (recommendation: LineupRecommendation) => string;
  buildRosterNeeds: (
    team: FantasyTeam,
    rosterPositions: string[],
  ) => Array<{ position: string; rostered: number; recommended: number; deficit: number }>;
  buildMatchupContext: (
    weeklyProjections: Array<Array<{ player_id: string; opponent?: string | null }>>,
    players: FantasyPlayer[],
    startingWeek: number,
  ) => unknown[];
  isEligible: (player: FantasyPlayer, slot: string) => boolean;
  optimizeLineup: (
    players: LineupRecommendation['recommendedStarters'],
    slots: string[],
    direction: 'min' | 'max',
  ) => LineupRecommendation['recommendedStarters'];
  projectedPoints: (
    stats: Record<string, number | null | undefined> | undefined,
    scoringSettings: Record<string, number> | undefined,
  ) => number | null;
  getWaiverBidGuidance: (
    league: SleeperLeague,
    state: { season: string; week: number; season_type: 'pre' | 'regular' | 'post' },
    currentRounds: number[],
    currentTransactionGroups: SleeperTransaction[][],
    currentProjections: SleeperProjection[],
    candidates: FantasyPlayer[],
    players: Record<string, SleeperPlayer | undefined>,
    remainingBudget: number,
  ) => Promise<WaiverBidGuidance>;
  buildWaiverBidGuidance: (
    samples: Array<{ pricePerPoint: number; position: string | null; weight: number }>,
    league: SleeperLeague,
    currentProjections: SleeperProjection[],
    candidates: FantasyPlayer[],
    remainingBudget: number,
  ) => WaiverBidGuidance;
  weightedMedian: (samples: Array<{ pricePerPoint: number; weight: number }>) => number | null;
};

describe('FantasyService', () => {
  const findOne = vi.fn();
  const create = vi.fn();
  let service: FantasyService;

  beforeEach(() => {
    (getRepository as Mock).mockReturnValue({ findOne });
    create.mockResolvedValue(aiResponse);
    service = new FantasyService({ responses: { create } } as unknown as OpenAIClientLike);
  });

  it('returns an unlinked landing response without requesting Sleeper leagues', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: null });
    (Axios.get as Mock).mockResolvedValueOnce({ data: { season: '2026', week: 1 } });

    await expect(service.getLanding('U1', 'T1')).resolves.toEqual({
      sleeperUser: null,
      leagues: [],
      season: '2026',
    });
    expect(Axios.get).toHaveBeenCalledOnce();
  });

  it('rejects invalid league IDs without calling Sleeper', async () => {
    await expect(service.getOverview('U1', 'T1', 'not-a-league')).rejects.toThrow(/invalid league/i);
    expect(Axios.get).not.toHaveBeenCalled();
  });

  it('returns no overview when the user has not linked Sleeper', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: null });

    await expect(service.getOverview('U1', 'T1', '999')).resolves.toBeNull();
    expect(Axios.get).not.toHaveBeenCalled();
  });

  it('caches AI analysis for 24 hours and bypasses the cache on refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
    const internals = service as unknown as FantasyServiceInternals;
    const analysis: AITradeAnalysis = {
      teamHealth: { percentage: 80, summary: 'Healthy roster.' },
      tradeInsights: [],
      suggestions: [],
      waiverSuggestions: [],
      lineupSummary: 'Use the projected starters.',
    };
    const generate = vi.fn().mockResolvedValue(analysis);

    try {
      await expect(internals.getTradeAnalysis('U1:T1:999:1:2026:1', false, generate)).resolves.toBe(analysis);
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1);
      await expect(internals.getTradeAnalysis('U1:T1:999:1:2026:1', false, generate)).resolves.toBe(analysis);
      expect(generate).toHaveBeenCalledOnce();

      await expect(internals.getTradeAnalysis('U1:T1:999:1:2026:1', true, generate)).resolves.toBe(analysis);
      expect(generate).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      await expect(internals.getTradeAnalysis('U1:T1:999:1:2026:1', false, generate)).resolves.toBe(analysis);
      expect(generate).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds a league overview with AI trade analysis and roster-relevant games', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    (Axios.get as Mock).mockImplementation((url: string) => {
      if (url.endsWith('/state/nfl')) {
        return Promise.resolve({ data: { season: '2026', week: 1, season_type: 'regular' } });
      }
      if (url.includes('/user/123/leagues/nfl/2026')) {
        return Promise.resolve({
          data: [
            {
              league_id: '999',
              name: 'Friends League',
              season: '2026',
              status: 'in_season',
              avatar: null,
              total_rosters: 2,
              roster_positions: ['RB'],
              scoring_settings: { rush_yd: 0.1, rush_td: 6 },
            },
          ],
        });
      }
      if (url.endsWith('/league/999/rosters')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, owner_id: '123', players: ['p1', 'p4'], starters: ['p1'] },
            { roster_id: 2, owner_id: '456', players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.endsWith('/league/999/users')) {
        return Promise.resolve({
          data: [
            { user_id: '123', username: 'alice', display_name: 'Alice' },
            { user_id: '456', username: 'bob', display_name: 'Bob' },
          ],
        });
      }
      if (url.endsWith('/league/999/matchups/1')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, matchup_id: 7, players: ['p1', 'p4'], starters: ['p1'] },
            { roster_id: 2, matchup_id: 7, players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/1')) {
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'NYJ', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p2', opponent: 'BUF', stats: { rush_yd: 50, rush_td: 1 } },
            { player_id: 'p3', opponent: 'KC', stats: { rush_yd: 80, rush_td: 1 } },
            { player_id: 'p4', opponent: 'KC', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/2')) {
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'NE', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p3', opponent: '@BUF', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/3')) {
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'MIA', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p3', opponent: 'vs. NYJ', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.endsWith('/league/999/transactions/1')) {
        return Promise.resolve({
          data: [
            {
              transaction_id: 'trade-1',
              type: 'trade',
              status: 'pending',
              roster_ids: [1, 2],
              adds: { p2: 1, p1: 2 },
              drops: { p1: 1, p2: 2 },
              draft_picks: [],
              created: 1788883200000,
            },
            {
              transaction_id: 'waiver-1',
              type: 'waiver',
              status: 'pending',
              roster_ids: [1],
              adds: { p3: 1 },
              drops: { p1: 1 },
              settings: { waiver_bid: 14 },
              created: 1788883300000,
            },
            {
              transaction_id: 'completed-waiver',
              type: 'waiver',
              status: 'complete',
              roster_ids: [1],
              adds: { p4: 1 },
              drops: null,
              settings: { waiver_bid: 5 },
              created: 1788883100000,
            },
          ],
        });
      }
      if (url.includes('/players/nfl')) {
        return Promise.resolve({
          data: {
            p1: {
              player_id: 'p1',
              first_name: 'Alex',
              last_name: 'Receiver',
              position: 'WR',
              team: 'BUF',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p2: {
              player_id: 'p2',
              first_name: 'Blake',
              last_name: 'Runner',
              position: 'RB',
              team: 'NYJ',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p3: {
              player_id: 'p3',
              first_name: 'Casey',
              last_name: 'Waiver',
              position: 'RB',
              team: 'DAL',
              injury_status: null,
              fantasy_positions: ['RB'],
              search_rank: 10,
            },
            p4: {
              player_id: 'p4',
              first_name: 'Drew',
              last_name: 'Runner',
              position: 'RB',
              team: 'DAL',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
          },
        });
      }
      if (new URL(url).hostname === 'site.api.espn.com') {
        return Promise.resolve({
          data: {
            events: [
              {
                id: 'game-1',
                date: '2026-09-10T00:00:00.000Z',
                status: { type: { shortDetail: 'Thu, 8:00 PM' } },
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'away', team: { abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
                      { homeAway: 'home', team: { abbreviation: 'NYJ', displayName: 'New York Jets' } },
                    ],
                    broadcasts: [{ names: ['NBC'] }],
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.getOverview('U1', 'T1', '999');

    expect(result?.league.name).toBe('Friends League');
    expect(result?.pendingTrades[0]).toMatchObject({
      transactionId: 'trade-1',
      insight: 'The incoming receiver adds weekly upside.',
      recommendation: 'accept',
    });
    expect(result?.pendingTrades[0]?.sides[0]?.players[0]?.name).toBe('Blake Runner');
    expect(result?.gamesToWatch[0]).toMatchObject({
      awayTeam: 'Buffalo Bills',
      homeTeam: 'New York Jets',
      broadcast: 'NBC',
    });
    expect(result?.tradeSuggestions[0]).toMatchObject({
      targetOwnerName: 'Bob',
      sleeperUrl: 'https://sleeper.com/leagues/999',
    });
    expect(result?.waiverSuggestions[0]).toMatchObject({
      add: { id: 'p3', name: 'Casey Waiver' },
      drop: { id: 'p1', name: 'Alex Receiver' },
      priority: 'high',
      recommendedBid: 5,
    });
    expect(result?.pendingWaivers[0]).toMatchObject({
      transactionId: 'waiver-1',
      add: { id: 'p3', name: 'Casey Waiver' },
      drop: { id: 'p1', name: 'Alex Receiver' },
      bid: 14,
    });
    expect(result?.teamHealth).toEqual({
      percentage: 82,
      rating: 'good',
      summary: 'Strong starters and balanced depth make this roster a contender.',
    });
    expect(result?.aiStatus).toBe('ready');
    expect(result?.lineupRecommendation).toMatchObject({
      week: 1,
      opponentOwnerName: 'Bob',
      userPotential: { min: 2, max: 14 },
      opponentPotential: { min: 11, max: 11 },
      start: [{ id: 'p4' }],
      sit: [{ id: 'p1' }],
      summary: 'Start Drew Runner to maximize your matchup ceiling this week.',
    });
  });

  it('normalizes week-zero matchup context before generating AI analysis', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    const getTradeAnalysisSpy = vi.spyOn(service as unknown as { getTradeAnalysis: unknown }, 'getTradeAnalysis');
    const sleeperProjectionWeeks: number[] = [];
    (Axios.get as Mock).mockImplementation((url: string, config?: { params?: { week?: number } }) => {
      if (url.endsWith('/state/nfl')) {
        return Promise.resolve({ data: { season: '2026', week: 0, season_type: 'regular' } });
      }
      if (url.includes('/user/123/leagues/nfl/2026')) {
        return Promise.resolve({
          data: [
            {
              league_id: '999',
              name: 'Friends League',
              season: '2026',
              status: 'in_season',
              avatar: null,
              total_rosters: 2,
              roster_positions: ['RB'],
              scoring_settings: { rush_yd: 0.1, rush_td: 6 },
            },
          ],
        });
      }
      if (url.endsWith('/league/999/rosters')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, owner_id: '123', players: ['p1'], starters: ['p1'] },
            { roster_id: 2, owner_id: '456', players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.endsWith('/league/999/users')) {
        return Promise.resolve({
          data: [
            { user_id: '123', username: 'alice', display_name: 'Alice' },
            { user_id: '456', username: 'bob', display_name: 'Bob' },
          ],
        });
      }
      if (url.endsWith('/league/999/matchups/1')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, matchup_id: 7, players: ['p1'], starters: ['p1'] },
            { roster_id: 2, matchup_id: 7, players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/1')) {
        sleeperProjectionWeeks.push(1);
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'NYJ', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p2', opponent: 'BUF', stats: { rush_yd: 50, rush_td: 1 } },
            { player_id: 'p3', opponent: 'KC', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/2')) {
        sleeperProjectionWeeks.push(2);
        return Promise.resolve({
          data: [{ player_id: 'p1', opponent: '@DAL', stats: { rush_yd: 20, rush_td: 0 } }],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/3')) {
        sleeperProjectionWeeks.push(3);
        return Promise.resolve({
          data: [{ player_id: 'p3', opponent: 'vs. KC', stats: { rush_yd: 80, rush_td: 1 } }],
        });
      }
      if (url.endsWith('/league/999/transactions/1')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/players/nfl')) {
        return Promise.resolve({
          data: {
            p1: {
              player_id: 'p1',
              first_name: 'Alex',
              last_name: 'Receiver',
              position: 'RB',
              team: 'BUF',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p2: {
              player_id: 'p2',
              first_name: 'Blake',
              last_name: 'Runner',
              position: 'RB',
              team: 'NYJ',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p3: {
              player_id: 'p3',
              first_name: 'Casey',
              last_name: 'Waiver',
              position: 'RB',
              team: 'DAL',
              injury_status: null,
              fantasy_positions: ['RB'],
              search_rank: 10,
            },
          },
        });
      }
      if (new URL(url).hostname === 'site.api.espn.com') {
        const week = config?.params?.week ?? 0;
        return Promise.resolve({
          data: {
            events: [
              {
                date: `2026-09-${String(week + 9).padStart(2, '0')}T00:00:00.000Z`,
                status: { type: { shortDetail: 'Thu, 8:00 PM' } },
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'away', team: { abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
                      { homeAway: 'home', team: { abbreviation: 'NYJ', displayName: 'New York Jets' } },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await service.getOverview('U1', 'T1', '999');

    const [cacheKey] = getTradeAnalysisSpy.mock.calls.at(-1) as [string, boolean, () => Promise<AITradeAnalysis>];
    expect(cacheKey).toBe('T1:U1:999:1:2026:regular:1');
    const payload = JSON.parse((create.mock.calls.at(-1) as [Record<string, string>])[0].input);
    expect(payload.currentWeek).toBe(1);
    expect(payload.matchupContext.map(({ week }: { week: number }) => week)).toEqual([1, 1, 2, 3]);
    expect(payload.matchupContext).toEqual([
      { week: 1, rosterTeam: 'BUF', opponent: 'NYJ', startsAt: null },
      { week: 1, rosterTeam: 'DAL', opponent: 'KC', startsAt: null },
      { week: 2, rosterTeam: 'BUF', opponent: 'DAL', startsAt: null },
      { week: 3, rosterTeam: 'DAL', opponent: 'KC', startsAt: null },
    ]);
    expect([...sleeperProjectionWeeks].sort((left, right) => left - right)).toEqual([1, 2, 3]);
  });

  it('uses normalized week and season type in the AI cache key', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    const getTradeAnalysisSpy = vi.spyOn(service as unknown as { getTradeAnalysis: unknown }, 'getTradeAnalysis');
    const sleeperProjectionWeeks: number[] = [];
    (Axios.get as Mock).mockImplementation((url: string, config?: { params?: { week?: number } }) => {
      if (url.endsWith('/state/nfl')) {
        return Promise.resolve({ data: { season: '2026', week: 0, season_type: 'pre' } });
      }
      if (url.includes('/user/123/leagues/nfl/2026')) {
        return Promise.resolve({
          data: [
            {
              league_id: '999',
              name: 'Friends League',
              season: '2026',
              status: 'in_season',
              avatar: null,
              total_rosters: 2,
              roster_positions: ['RB'],
              scoring_settings: { rush_yd: 0.1, rush_td: 6 },
            },
          ],
        });
      }
      if (url.endsWith('/league/999/rosters')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, owner_id: '123', players: ['p1'], starters: ['p1'] },
            { roster_id: 2, owner_id: '456', players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.endsWith('/league/999/users')) {
        return Promise.resolve({
          data: [
            { user_id: '123', username: 'alice', display_name: 'Alice' },
            { user_id: '456', username: 'bob', display_name: 'Bob' },
          ],
        });
      }
      if (url.endsWith('/league/999/matchups/1')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, matchup_id: 7, players: ['p1'], starters: ['p1'] },
            { roster_id: 2, matchup_id: 7, players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/1')) {
        sleeperProjectionWeeks.push(1);
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'NYJ', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p2', opponent: 'BUF', stats: { rush_yd: 50, rush_td: 1 } },
            { player_id: 'p3', opponent: 'KC', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.endsWith('/league/999/transactions/1')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/players/nfl')) {
        return Promise.resolve({
          data: {
            p1: {
              player_id: 'p1',
              first_name: 'Alex',
              last_name: 'Receiver',
              position: 'RB',
              team: 'BUF',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p2: {
              player_id: 'p2',
              first_name: 'Blake',
              last_name: 'Runner',
              position: 'RB',
              team: 'NYJ',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p3: {
              player_id: 'p3',
              first_name: 'Casey',
              last_name: 'Waiver',
              position: 'RB',
              team: 'DAL',
              injury_status: null,
              fantasy_positions: ['RB'],
              search_rank: 10,
            },
          },
        });
      }
      if (new URL(url).hostname === 'site.api.espn.com') {
        const week = config?.params?.week ?? 0;
        return Promise.resolve({
          data: {
            events: [
              {
                date: `2026-09-${String(week + 9).padStart(2, '0')}T00:00:00.000Z`,
                status: { type: { shortDetail: 'Thu, 8:00 PM' } },
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'away', team: { abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
                      { homeAway: 'home', team: { abbreviation: 'NYJ', displayName: 'New York Jets' } },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await service.getOverview('U1', 'T1', '999');

    const [cacheKey] = getTradeAnalysisSpy.mock.calls.at(-1) as [string, boolean, () => Promise<AITradeAnalysis>];
    expect(cacheKey).toBe('T1:U1:999:1:2026:pre:1');
    expect([...sleeperProjectionWeeks].sort((left, right) => left - right)).toEqual([1]);
  });

  it('does not request out-of-range upcoming regular-season projections', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    const sleeperProjectionWeeks: number[] = [];
    (Axios.get as Mock).mockImplementation((url: string, config?: { params?: { week?: number } }) => {
      if (url.endsWith('/state/nfl')) {
        return Promise.resolve({ data: { season: '2026', week: 18, season_type: 'regular' } });
      }
      if (url.includes('/user/123/leagues/nfl/2026')) {
        return Promise.resolve({
          data: [
            {
              league_id: '999',
              name: 'Friends League',
              season: '2026',
              status: 'in_season',
              avatar: null,
              total_rosters: 2,
              roster_positions: ['RB'],
              scoring_settings: { rush_yd: 0.1, rush_td: 6 },
            },
          ],
        });
      }
      if (url.endsWith('/league/999/rosters')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, owner_id: '123', players: ['p1'], starters: ['p1'] },
            { roster_id: 2, owner_id: '456', players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.endsWith('/league/999/users')) {
        return Promise.resolve({
          data: [
            { user_id: '123', username: 'alice', display_name: 'Alice' },
            { user_id: '456', username: 'bob', display_name: 'Bob' },
          ],
        });
      }
      if (url.endsWith('/league/999/matchups/18')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, matchup_id: 7, players: ['p1'], starters: ['p1'] },
            { roster_id: 2, matchup_id: 7, players: ['p2'], starters: ['p2'] },
          ],
        });
      }
      if (url.includes('api.sleeper.com/projections/nfl/2026/18')) {
        sleeperProjectionWeeks.push(18);
        return Promise.resolve({
          data: [
            { player_id: 'p1', opponent: 'NYJ', stats: { rush_yd: 20, rush_td: 0 } },
            { player_id: 'p2', opponent: 'BUF', stats: { rush_yd: 50, rush_td: 1 } },
            { player_id: 'p3', opponent: 'KC', stats: { rush_yd: 80, rush_td: 1 } },
          ],
        });
      }
      if (url.endsWith('/league/999/transactions/18')) {
        return Promise.resolve({ data: [] });
      }
      if (url.endsWith('/league/999/transactions/17')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/players/nfl')) {
        return Promise.resolve({
          data: {
            p1: {
              player_id: 'p1',
              first_name: 'Alex',
              last_name: 'Receiver',
              position: 'RB',
              team: 'BUF',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p2: {
              player_id: 'p2',
              first_name: 'Blake',
              last_name: 'Runner',
              position: 'RB',
              team: 'NYJ',
              injury_status: null,
              fantasy_positions: ['RB'],
            },
            p3: {
              player_id: 'p3',
              first_name: 'Casey',
              last_name: 'Waiver',
              position: 'RB',
              team: 'DAL',
              injury_status: null,
              fantasy_positions: ['RB'],
              search_rank: 10,
            },
          },
        });
      }
      if (new URL(url).hostname === 'site.api.espn.com') {
        const week = config?.params?.week ?? 0;
        return Promise.resolve({
          data: {
            events: [
              {
                date: `2026-09-${String(week + 9).padStart(2, '0')}T00:00:00.000Z`,
                status: { type: { shortDetail: 'Thu, 8:00 PM' } },
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'away', team: { abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
                      { homeAway: 'home', team: { abbreviation: 'NYJ', displayName: 'New York Jets' } },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await service.getOverview('U1', 'T1', '999');

    expect([...sleeperProjectionWeeks].sort((left, right) => left - right)).toEqual([18]);
  });

  it('returns league data with fallback insights when AI is unavailable', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    create.mockRejectedValue(new Error('AI unavailable'));
    (Axios.get as Mock).mockImplementation((url: string) => {
      if (url.endsWith('/state/nfl')) {
        return Promise.resolve({ data: { season: '2026', week: 2, season_type: 'post' } });
      }
      if (url.includes('/user/123/leagues/nfl/2026')) {
        return Promise.resolve({
          data: [
            {
              league_id: '999',
              name: 'Friends League',
              season: '2026',
              status: 'in_season',
              avatar: null,
              total_rosters: 2,
            },
          ],
        });
      }
      if (url.endsWith('/league/999/rosters')) {
        return Promise.resolve({
          data: [
            { roster_id: 1, owner_id: '123', players: ['p1'], starters: null },
            { roster_id: 2, owner_id: '456', players: null, starters: null },
          ],
        });
      }
      if (url.endsWith('/league/999/users')) {
        return Promise.resolve({ data: [] });
      }
      if (url.endsWith('/league/999/matchups/2')) return Promise.resolve({ data: [] });
      if (url.includes('api.sleeper.com/projections/nfl/2026/2')) {
        return Promise.reject(new Error('Projections unavailable'));
      }
      if (url.endsWith('/league/999/transactions/2')) {
        return Promise.resolve({
          data: [
            {
              transaction_id: 'trade-1',
              type: 'trade',
              status: 'pending',
              roster_ids: [1, 2],
              adds: null,
              drops: null,
              draft_picks: null,
              created: 1788883200000,
            },
          ],
        });
      }
      if (url.endsWith('/league/999/transactions/1')) return Promise.resolve({ data: [] });
      if (url.includes('/players/nfl')) {
        return Promise.resolve({
          data: {
            p1: {
              player_id: 'p1',
              first_name: null,
              last_name: null,
              position: null,
              team: 'WAS',
              injury_status: 'Questionable',
            },
          },
        });
      }
      if (new URL(url).hostname === 'site.api.espn.com') {
        return Promise.resolve({
          data: {
            events: [
              {
                id: 'washington-game',
                date: '2026-09-10T00:00:00.000Z',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'away', team: { abbreviation: 'WSH' } },
                      { homeAway: 'home', team: { abbreviation: 'DAL' } },
                    ],
                  },
                ],
              },
              { id: 'incomplete-game', competitions: [] },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.getOverview('U1', 'T1', '999');

    expect(result?.aiStatus).toBe('unavailable');
    expect(result?.lineupStatus).toBe('unavailable');
    expect(result?.lineupRecommendation).toBeNull();
    expect(result?.teamHealth).toBeNull();
    expect(result?.waiverSuggestions).toEqual([]);
    expect(result?.pendingTrades[0]).toMatchObject({
      insight: 'AI insight is temporarily unavailable for this trade.',
      recommendation: 'negotiate',
    });
    expect(result?.gamesToWatch[0]?.rosterPlayers[0]?.id).toBe('p1');
    expect(result?.roster.ownerName).toBe('Roster 1');
  });

  it('handles flexible lineup slots and projection scoring fallbacks', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const player = (id: string, position: string, projectedPoints: number) => ({
      id,
      name: id,
      position,
      team: 'BUF',
      injuryStatus: null,
      fantasyPositions: [position],
      projectedPoints,
    });
    const players = [
      player('qb-high', 'QB', 20),
      player('qb-low', 'QB', 10),
      player('rb', 'RB', 15),
      player('wr', 'WR', 12),
      player('te', 'TE', 8),
      player('dl', 'DL', 6),
    ];

    expect(internals.isEligible(players[2]!, 'FLEX')).toBe(true);
    expect(internals.isEligible(players[0]!, 'SUPER_FLEX')).toBe(true);
    expect(internals.isEligible(players[3]!, 'REC_FLEX')).toBe(true);
    expect(internals.isEligible(players[2]!, 'WRRB_FLEX')).toBe(true);
    expect(internals.isEligible(players[5]!, 'IDP_FLEX')).toBe(true);
    expect(internals.isEligible(players[2]!, 'QB')).toBe(false);
    expect(internals.optimizeLineup(players, ['QB', 'SUPER_FLEX'], 'max').map(({ id }) => id)).toEqual([
      'qb-high',
      'rb',
    ]);
    expect(internals.optimizeLineup(players, ['QB', 'SUPER_FLEX'], 'min').map(({ id }) => id)).toEqual([
      'qb-low',
      'te',
    ]);
    expect(internals.optimizeLineup(players, ['K'], 'max')).toEqual([]);
    expect(internals.projectedPoints(undefined, undefined)).toBeNull();
    expect(internals.projectedPoints({ rush_yd: 40 }, { pass_yd: 0.04 })).toBeNull();
    expect(internals.projectedPoints({ rush_yd: null }, { rush_yd: 0.1 })).toBe(0);
    expect(internals.projectedPoints({ pts_half_ppr: 9 }, undefined)).toBe(9);
    expect(internals.projectedPoints({ pts_std: 7 }, {})).toBe(7);
    expect(internals.projectedPoints({}, undefined)).toBeNull();
  });

  it('identifies positional roster gaps while ignoring bench and flex slots', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const needs = internals.buildRosterNeeds(
      {
        rosterId: 1,
        ownerName: 'Alice',
        starters: [],
        players: [
          {
            id: 'qb',
            name: 'Quarterback',
            position: 'QB',
            team: 'BUF',
            injuryStatus: null,
            fantasyPositions: ['QB'],
          },
          {
            id: 'unknown',
            name: 'Unknown',
            position: null,
            team: null,
            injuryStatus: null,
            fantasyPositions: [],
          },
          {
            id: 'edge',
            name: 'Edge Rusher',
            position: 'DE',
            team: 'DAL',
            injuryStatus: null,
            fantasyPositions: ['DL'],
          },
          {
            id: 'swing',
            name: 'Swing Skill',
            position: 'RB',
            team: 'MIA',
            injuryStatus: null,
            fantasyPositions: ['RB', 'WR'],
          },
        ],
      },
      ['QB', 'RB', 'WR', 'DL', 'FLEX', 'BN', 'IR'],
    );

    expect(needs).toEqual([{ position: 'WR', rostered: 0, recommended: 1, deficit: 1 }]);
  });

  it('assigns multi-eligible players to maximize filled required slots', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const needs = internals.buildRosterNeeds(
      {
        rosterId: 1,
        ownerName: 'Alice',
        starters: [],
        players: [
          {
            id: 'flex-qb-wr',
            name: 'Flex QB WR',
            position: 'QB',
            team: 'DAL',
            injuryStatus: null,
            fantasyPositions: ['QB', 'WR'],
          },
          {
            id: 'qb-only',
            name: 'QB Only',
            position: 'QB',
            team: 'BUF',
            injuryStatus: null,
            fantasyPositions: ['QB'],
          },
        ],
      },
      ['QB', 'WR'],
    );

    expect(needs).toEqual([]);
  });

  it('builds current and upcoming matchup context from sleeper projections', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const players: FantasyPlayer[] = [
      {
        id: 'washington-player',
        name: 'Washington Player',
        position: 'WR',
        team: 'WAS',
        injuryStatus: null,
        fantasyPositions: ['WR'],
      },
      {
        id: 'jacksonville-player',
        name: 'Jacksonville Player',
        position: 'RB',
        team: 'JAC',
        injuryStatus: null,
        fantasyPositions: ['RB'],
      },
    ];

    expect(
      internals.buildMatchupContext(
        [
          [
            { player_id: 'washington-player', opponent: '@DAL' },
            { player_id: 'jacksonville-player', opponent: 'MIA' },
            { player_id: 'jacksonville-player', opponent: 'MIA' },
            { player_id: 'washington-player', opponent: null },
          ],
        ],
        players,
        3,
      ),
    ).toEqual([
      { week: 3, rosterTeam: 'WSH', opponent: 'DAL', startsAt: null },
      { week: 3, rosterTeam: 'JAX', opponent: 'MIA', startsAt: null },
    ]);
  });

  it('prices waiver bids from prior-league dollars per projected point', async () => {
    const internals = service as unknown as FantasyServiceInternals;
    (Axios.get as Mock).mockImplementation((url: string) => {
      if (url.endsWith('/league/888')) {
        return Promise.resolve({
          data: {
            league_id: '888',
            previous_league_id: null,
            name: 'Friends League',
            season: '2025',
            status: 'complete',
            avatar: null,
            total_rosters: 2,
            settings: { waiver_budget: 200 },
            scoring_settings: { pts_ppr: 1 },
          },
        });
      }
      if (url.endsWith('/league/888/transactions/1')) {
        return Promise.resolve({
          data: [
            {
              transaction_id: 'historical-waiver',
              type: 'waiver',
              status: 'complete',
              roster_ids: [1],
              adds: { historical: 1 },
              drops: null,
              settings: { waiver_bid: 40 },
              created: 1756857600000,
            },
          ],
        });
      }
      if (url.includes('/league/888/transactions/')) return Promise.resolve({ data: [] });
      if (url.includes('/projections/nfl/2025/1')) {
        return Promise.resolve({
          data: [{ player_id: 'historical', stats: { pts_ppr: 10 } }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const candidate: FantasyPlayer = {
      id: 'candidate',
      name: 'Current Candidate',
      position: 'RB',
      team: 'BUF',
      injuryStatus: null,
      fantasyPositions: ['RB'],
    };
    const guidance = await internals.getWaiverBidGuidance(
      {
        league_id: '999',
        previous_league_id: '888',
        name: 'Friends League',
        season: '2026',
        status: 'in_season',
        avatar: null,
        total_rosters: 2,
        settings: { waiver_budget: 100 },
        scoring_settings: { pts_ppr: 1 },
      },
      { season: '2026', week: 1, season_type: 'regular' },
      [1],
      [[]],
      [{ player_id: 'candidate', stats: { pts_ppr: 15 } }],
      [candidate],
      {
        historical: {
          player_id: 'historical',
          first_name: 'Past',
          last_name: 'Player',
          position: 'RB',
          team: null,
          injury_status: null,
        },
      },
      100,
    );

    expect(guidance).toEqual({
      sampleSize: 1,
      suggestedBids: { candidate: 30 },
    });
  });

  it('handles sparse, position-specific, and budget-limited waiver markets', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const league: SleeperLeague = {
      league_id: '999',
      name: 'Friends League',
      season: '2026',
      status: 'in_season',
      avatar: null,
      total_rosters: 2,
      settings: { waiver_budget: 100 },
      scoring_settings: { pts_ppr: 1 },
    };
    const candidate = (id: string, position: string): FantasyPlayer => ({
      id,
      name: id,
      position,
      team: 'BUF',
      injuryStatus: null,
      fantasyPositions: [position],
    });

    expect(internals.weightedMedian([])).toBeNull();
    expect(
      internals.weightedMedian([
        { pricePerPoint: 0.1, weight: 1 },
        { pricePerPoint: 0.2, weight: 2 },
      ]),
    ).toBe(0.2);
    expect(internals.buildWaiverBidGuidance([], league, [], [candidate('rb', 'RB')], 50)).toEqual({
      sampleSize: 0,
      suggestedBids: {},
    });
    expect(
      internals.buildWaiverBidGuidance(
        Array.from({ length: 5 }, () => ({ pricePerPoint: 0.02, position: 'RB', weight: 1 })).concat({
          pricePerPoint: 0.5,
          position: 'WR',
          weight: 1,
        }),
        league,
        [
          { player_id: 'rb', stats: { pts_ppr: 20 } },
          { player_id: 'wr', stats: { pts_ppr: 0 } },
          { player_id: 'missing', stats: {} },
        ],
        [candidate('rb', 'RB'), candidate('wr', 'WR'), candidate('missing', 'TE')],
        25,
      ),
    ).toEqual({
      sampleSize: 6,
      suggestedBids: { rb: 25 },
    });
  });

  it('rejects incomplete lineup inputs and supports a matchup without an opponent', () => {
    const internals = service as unknown as FantasyServiceInternals;
    const ownRoster: FantasyTeam = {
      rosterId: 1,
      ownerName: 'Alice',
      starters: [],
      players: [
        {
          id: 'rb1',
          name: 'Runner',
          position: 'RB',
          team: 'BUF',
          injuryStatus: null,
          fantasyPositions: ['RB'],
        },
      ],
    };
    const league: SleeperLeague = {
      league_id: '999',
      name: 'Friends League',
      season: '2026',
      status: 'in_season',
      avatar: null,
      total_rosters: 2,
      roster_positions: ['RB', 'BN'],
    };

    expect(internals.buildLineupRecommendation(1, league, ownRoster, [ownRoster], [], [])).toBeNull();
    expect(
      internals.buildLineupRecommendation(
        1,
        league,
        ownRoster,
        [ownRoster],
        [{ roster_id: 1, matchup_id: null, players: ['rb1'], starters: [] }],
        [],
      ),
    ).toBeNull();
    expect(
      internals.buildLineupRecommendation(
        1,
        { ...league, roster_positions: ['BN', 'IR', 'TAXI'] },
        ownRoster,
        [ownRoster],
        [{ roster_id: 1, matchup_id: 4, players: ['rb1'], starters: [] }],
        [],
      ),
    ).toBeNull();
    expect(() =>
      internals.buildLineupRecommendation(
        1,
        league,
        ownRoster,
        [ownRoster],
        [{ roster_id: 1, matchup_id: 4, players: ['rb1'], starters: [] }],
        [],
      ),
    ).toThrow(/no usable weekly projections for the user/i);

    const recommendation = internals.buildLineupRecommendation(
      1,
      league,
      ownRoster,
      [ownRoster],
      [{ roster_id: 1, matchup_id: 4, players: ['rb1'], starters: [] }],
      [{ player_id: 'rb1', stats: { pts_ppr: 12.34 } }],
    );
    expect(recommendation).toMatchObject({
      opponentOwnerName: null,
      userPotential: { min: 12.3, max: 12.3 },
      opponentPotential: null,
    });
    expect(internals.buildLineupFallbackSummary(recommendation!)).toBe(
      'The highest-projected lineup for week 1 is 12.3 points.',
    );

    const opponent: FantasyTeam = {
      ...ownRoster,
      rosterId: 2,
      ownerName: 'Bob',
      players: [{ ...ownRoster.players[0]!, id: 'rb2' }],
    };
    expect(() =>
      internals.buildLineupRecommendation(
        1,
        league,
        ownRoster,
        [ownRoster, opponent],
        [
          { roster_id: 1, matchup_id: 4, players: ['rb1'], starters: [] },
          { roster_id: 2, matchup_id: 4, players: ['rb2'], starters: [] },
        ],
        [{ player_id: 'rb1', stats: { pts_ppr: 12 } }],
      ),
    ).toThrow(/no usable weekly projections for the opponent/i);
  });
});
