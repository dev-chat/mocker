import Axios from 'axios';
import { getRepository } from 'typeorm';
import type { OpenAIClientLike } from '../lib/resilientOpenAIClient';
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
              },
            ],
          }),
        },
      ],
    },
  ],
};

describe('FantasyService', () => {
  const findOne = vi.fn();
  const update = vi.fn();
  const create = vi.fn();
  let service: FantasyService;

  beforeEach(() => {
    (getRepository as Mock).mockReturnValue({ findOne, update });
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

  it('resolves and stores a Sleeper user ID', async () => {
    (Axios.get as Mock).mockResolvedValueOnce({
      data: { user_id: '123', username: 'alice', display_name: 'Alice', avatar: null },
    });
    update.mockResolvedValue({ affected: 1 });

    await expect(service.linkSleeperUser('U1', 'T1', 'alice')).resolves.toMatchObject({ user_id: '123' });
    expect(update).toHaveBeenCalledWith({ slackId: 'U1', teamId: 'T1' }, { sleeperUserId: '123' });
  });

  it('rejects empty Sleeper account identifiers', async () => {
    await expect(service.linkSleeperUser('U1', 'T1', '   ')).rejects.toThrow(/valid sleeper/i);
    expect(Axios.get).not.toHaveBeenCalled();
  });

  it('rejects valid Sleeper users when the authenticated user is missing', async () => {
    (Axios.get as Mock).mockResolvedValueOnce({
      data: { user_id: '123', username: 'alice', display_name: 'Alice', avatar: null },
    });
    update.mockResolvedValue({ affected: 0 });

    await expect(service.linkSleeperUser('U1', 'T1', 'alice')).rejects.toThrow(/authenticated user/i);
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

  it('builds a league overview with AI trade analysis and roster-relevant games', async () => {
    findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', sleeperUserId: '123' });
    (Axios.get as Mock).mockImplementation((url: string) => {
      if (url.endsWith('/state/nfl')) return Promise.resolve({ data: { season: '2026', week: 1 } });
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
            },
            p2: {
              player_id: 'p2',
              first_name: 'Blake',
              last_name: 'Runner',
              position: 'RB',
              team: 'NYJ',
              injury_status: null,
            },
            p3: {
              player_id: 'p3',
              first_name: 'Casey',
              last_name: 'Waiver',
              position: 'WR',
              team: 'DAL',
              injury_status: null,
              search_rank: 10,
            },
          },
        });
      }
      if (url.includes('site.api.espn.com')) {
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
    });
    expect(result?.aiStatus).toBe('ready');
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
      if (url.includes('site.api.espn.com')) {
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
    expect(result?.waiverSuggestions).toEqual([]);
    expect(result?.pendingTrades[0]).toMatchObject({
      insight: 'AI insight is temporarily unavailable for this trade.',
      recommendation: 'negotiate',
    });
    expect(result?.gamesToWatch[0]?.rosterPlayers[0]?.id).toBe('p1');
    expect(result?.roster.ownerName).toBe('Roster 1');
  });
});
