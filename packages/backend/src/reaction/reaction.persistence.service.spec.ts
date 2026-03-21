import { getRepository } from 'typeorm';
import { Purchase } from '../shared/db/models/Purchase';
import { Rep } from '../shared/db/models/Rep';
import { SlackUser } from '../shared/db/models/SlackUser';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { Reaction } from '../shared/db/models/Reaction';
import type { Event } from '../shared/models/slack/slack-models';
import { ReactionPersistenceService } from './reaction.persistence.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('ReactionPersistenceService', () => {
  let service: ReactionPersistenceService;

  const reactionRepo = {
    save: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const repRepo = {
    increment: jest.fn(),
  };

  const userQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => userQb),
  };

  const makeAggQb = (sum: number) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getSql: jest.fn().mockReturnValue('SELECT ...'),
    getRawOne: jest.fn().mockResolvedValue({ sum }),
  });

  const purchaseRepo = {
    createQueryBuilder: jest.fn(),
  };

  const portfolioRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReactionPersistenceService();

    (getRepository as jest.Mock).mockImplementation((model: unknown) => {
      if (model === Reaction) {
        return reactionRepo;
      }
      if (model === Rep) {
        return repRepo;
      }
      if (model === SlackUser) {
        return userRepo;
      }
      if (model === Purchase) {
        return purchaseRepo;
      }
      if (model === PortfolioTransactions) {
        return portfolioRepo;
      }
      return {};
    });
  });

  it('saves reaction from event fields', async () => {
    reactionRepo.save.mockResolvedValue({ id: 1 });
    const event = {
      item_user: 'U2',
      user: 'U1',
      reaction: '+1',
      item: { type: 'message', channel: 'C1' },
    } as Event;

    const out = await service.saveReaction(event, 1, 'T1');

    expect(reactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        affectedUser: 'U2',
        reactingUser: 'U1',
        reaction: '+1',
        value: 1,
        type: 'message',
        channel: 'C1',
        teamId: 'T1',
      }),
    );
    expect(out).toEqual({ id: 1 });
  });

  it('removes matching reaction rows', async () => {
    reactionRepo.delete.mockResolvedValue({ affected: 1 });
    const event = {
      item_user: 'U2',
      user: 'U1',
      reaction: '+1',
      item: { type: 'message', channel: 'C1' },
    } as Event;

    await service.removeReaction(event, 'T1');

    expect(reactionRepo.delete).toHaveBeenCalledWith({
      reaction: '+1',
      affectedUser: 'U2',
      reactingUser: 'U1',
      type: 'message',
      channel: 'C1',
      teamId: 'T1',
    });
  });

  it('gets rep by user from grouped query', async () => {
    reactionRepo.query.mockResolvedValue([{ reactingUser: 'U9', rep: 5 }]);

    const out = await service.getRepByUser('U1', 'T1');

    expect(reactionRepo.query).toHaveBeenCalledWith(expect.stringContaining('GROUP BY reactingUser'), ['U1', 'T1']);
    expect(out).toEqual([{ reactingUser: 'U9', rep: 5 }]);
  });

  it('throws when user is missing in getTotalRep', async () => {
    repRepo.increment.mockResolvedValue({});
    userQb.getOne.mockResolvedValue(null);

    await expect(service.getTotalRep('U1', 'T1')).rejects.toThrow('Unable to find user: U1 on team T1');
  });

  it('returns non-portfolio totals when user has no portfolio', async () => {
    repRepo.increment.mockResolvedValue({});
    userQb.getOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', portfolio: null });
    reactionRepo.createQueryBuilder.mockReturnValue(makeAggQb(20));
    purchaseRepo.createQueryBuilder.mockReturnValue(makeAggQb(7));

    const out = await service.getTotalRep('U1', 'T1');

    expect(out).toEqual({
      totalRepEarned: 20,
      totalRepSpent: 7,
      totalRepAvailable: 13,
      totalRepInvested: 0,
      totalRepInvestedNet: 0,
    });
  });

  it('returns portfolio-aware totals when portfolio exists', async () => {
    repRepo.increment.mockResolvedValue({});
    userQb.getOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', portfolio: { id: 99 } });
    reactionRepo.createQueryBuilder.mockReturnValue(makeAggQb(30));
    purchaseRepo.createQueryBuilder.mockReturnValue(makeAggQb(10));
    portfolioRepo.createQueryBuilder.mockReturnValueOnce(makeAggQb(12)).mockReturnValueOnce(makeAggQb(5));

    const out = await service.getTotalRep('U1', 'T1');

    expect(out).toEqual({
      totalRepEarned: 30,
      totalRepSpent: 10,
      totalRepAvailable: 13,
      totalRepInvested: 12,
      totalRepInvestedNet: -7,
    });
  });
});
