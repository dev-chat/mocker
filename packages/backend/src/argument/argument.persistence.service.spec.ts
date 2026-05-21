import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { ArgumentPersistenceService } from './argument.persistence.service';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('ArgumentPersistenceService', () => {
  const findOne = vi.fn();
  const save = vi.fn();
  const query = vi.fn();
  let service: ArgumentPersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ArgumentPersistenceService();
    (getRepository as Mock).mockImplementation((entity: { name?: string }) => {
      if (entity.name === 'SlackUser') {
        return { findOne };
      }

      return { save, query };
    });
  });

  it('saves an argument outcome with a resolved winner', async () => {
    findOne.mockResolvedValue({ id: 7, slackId: 'U2', name: 'Bob' });
    save.mockImplementation(async (entry: { createdAt?: Date }) => ({
      ...entry,
      id: 11,
      createdAt: entry.createdAt ?? new Date('2026-05-21T00:00:00.000Z'),
    }));

    const result = await service.saveArgumentOutcome({
      teamId: 'T1',
      channelId: 'C1',
      argumentSummary: 'Tabs versus spaces',
      participants: [
        { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
        { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
      ],
      winnerSlackId: 'U2',
      pointValue: 6,
    });

    expect(findOne).toHaveBeenCalledWith({ where: { slackId: 'U2', teamId: 'T1' } });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'T1',
        channelId: 'C1',
        argumentSummary: 'Tabs versus spaces',
        pointValue: 5,
      }),
    );
    expect(result).toMatchObject({
      id: 11,
      argument: 'Tabs versus spaces',
      winner: { name: 'Bob', slackId: 'U2' },
      pointValue: 5,
    });
  });

  it('returns null when the winner cannot be mapped to a slack user', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.saveArgumentOutcome({
        teamId: 'T1',
        channelId: 'C1',
        argumentSummary: 'Tabs versus spaces',
        participants: [
          { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
          { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
        ],
        winnerSlackId: 'U2',
        pointValue: 4,
      }),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('loads leaderboard standings and detailed argument outcomes', async () => {
    query
      .mockResolvedValueOnce([
        { name: 'Bob', slackId: 'U2', wins: '3', points: '12' },
        { name: 'Alice', slackId: 'U1', wins: '1', points: '4' },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          argumentSummary: 'tabs vs spaces',
          participants: JSON.stringify([
            { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
            { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
          ]),
          winnerName: 'Bob',
          winnerSlackId: 'U2',
          pointValue: '4',
          createdAt: '2026-05-21T00:00:00.000Z',
        },
      ]);

    const result = await service.getArgumentLeaderboard('T1');

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('CAST(COUNT(*) AS SIGNED) AS wins'), ['T1']);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('a.argumentSummary AS argumentSummary'), ['T1']);
    expect(result).toEqual({
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
      ],
    });
  });
});
