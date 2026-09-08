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
    expect(result?.aiStatus).toBe('ready');
  });
});
