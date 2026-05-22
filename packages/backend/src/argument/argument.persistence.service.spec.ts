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
  const findUsers = vi.fn();
  const save = vi.fn();
  const query = vi.fn();
  const findArguments = vi.fn();
  let service: ArgumentPersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ArgumentPersistenceService();
    (getRepository as Mock).mockImplementation((entity: { name?: string }) => {
      if (entity.name === 'SlackUser') {
        return { findOne, find: findUsers };
      }

      return { save, query, find: findArguments };
    });
  });

  it('saves an argument outcome with a resolved winner', async () => {
    findOne.mockResolvedValue({ id: 7, slackId: 'U2', name: 'Bob' });
    findUsers.mockResolvedValue([
      { id: 6, slackId: 'U1', name: 'Alice' },
      { id: 7, slackId: 'U2', name: 'Bob' },
    ]);
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

    expect(findOne).toHaveBeenCalledWith({ where: { slackId: 'U2', teamId: 'T1', isBot: false } });
    expect(findUsers).toHaveBeenCalledWith({
      where: [
        { slackId: 'U1', teamId: 'T1', isBot: false },
        { slackId: 'U2', teamId: 'T1', isBot: false },
      ],
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'T1',
        channelId: 'C1',
        argumentSummary: 'Tabs versus spaces',
        participants: [
          { id: 6, slackId: 'U1', name: 'Alice' },
          { id: 7, slackId: 'U2', name: 'Bob' },
        ],
        participantViewpoints: {
          U1: 'tabs are faster',
          U2: 'spaces are clearer',
        },
        pointValue: 5,
      }),
    );
    expect(result).toMatchObject({
      id: 11,
      argument: 'Tabs versus spaces',
      participants: [
        { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
        { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
      ],
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

  it('filters participant viewpoints to resolved participants before saving', async () => {
    findOne.mockResolvedValue({ id: 7, slackId: 'U2', name: 'Bob' });
    findUsers.mockResolvedValue([
      { id: 6, slackId: 'U1', name: 'Alice' },
      { id: 7, slackId: 'U2', name: 'Bob' },
    ]);
    save.mockImplementation(async (entry: { createdAt?: Date }) => ({
      ...entry,
      id: 12,
      createdAt: entry.createdAt ?? new Date('2026-05-21T00:00:00.000Z'),
    }));

    const result = await service.saveArgumentOutcome({
      teamId: 'T1',
      channelId: 'C1',
      argumentSummary: 'Tabs versus spaces',
      participants: [
        { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
        { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
        { slackId: 'U3', name: 'Cara', viewpoint: 'tabs are clearer' },
      ],
      winnerSlackId: 'U2',
      pointValue: 4,
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          { id: 6, slackId: 'U1', name: 'Alice' },
          { id: 7, slackId: 'U2', name: 'Bob' },
        ],
        participantViewpoints: {
          U1: 'tabs are faster',
          U2: 'spaces are clearer',
        },
      }),
    );
    expect(result?.participants).toEqual([
      { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
      { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
    ]);
  });

  it('loads leaderboard standings and detailed argument outcomes', async () => {
    query.mockResolvedValueOnce([
      { name: 'Bob', slackId: 'U2', wins: '3', points: '12' },
      { name: 'Alice', slackId: 'U1', wins: '1', points: '4' },
    ]);
    findArguments.mockResolvedValue([
      {
        id: 1,
        argumentSummary: 'tabs vs spaces',
        participants: [
          { id: 2, slackId: 'U2', name: 'Bob' },
          { id: 1, slackId: 'U1', name: 'Alice' },
        ],
        participantViewpoints: {
          U1: 'tabs are faster',
          U2: 'spaces are clearer',
        },
        winner: { id: 2, slackId: 'U2', name: 'Bob' },
        pointValue: '4',
        createdAt: '2026-05-21T00:00:00.000Z',
      },
    ]);

    const result = await service.getArgumentLeaderboard('T1');

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('CAST(COUNT(*) AS SIGNED) AS wins'), ['T1']);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('u.isBot = 0'), ['T1']);
    expect(findArguments).toHaveBeenCalledWith({
      where: { teamId: 'T1' },
      relations: ['participants', 'winner'],
      order: { createdAt: 'DESC' },
    });
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
