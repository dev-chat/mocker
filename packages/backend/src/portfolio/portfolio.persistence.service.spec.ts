import { getRepository } from 'typeorm';
import { Portfolio } from '../shared/db/models/Portfolio';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { SlackUser } from '../shared/db/models/SlackUser';
import { PortfolioPersistenceService, TransactionType } from './portfolio.persistence.service';

type QueryRunnerLike = {
  query: jest.Mock;
  createQueryBuilder?: jest.Mock;
};

type TransactionCallback = (entityManager: QueryRunnerLike) => Promise<unknown>;

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('PortfolioPersistenceService', () => {
  let service: PortfolioPersistenceService;

  const userQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const userRepo = {
    createQueryBuilder: jest.fn(() => userQb),
    save: jest.fn(),
  };

  const portfolioRepo = {
    save: jest.fn(),
  };

  const txQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const txRepo = {
    createQueryBuilder: jest.fn(() => txQb),
    manager: {
      transaction: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortfolioPersistenceService();
    type PortfolioPersistenceDependencies = PortfolioPersistenceService & {
      reactionPersistenceService: { getTotalRep: jest.Mock };
    };
    (service as unknown as PortfolioPersistenceDependencies).reactionPersistenceService = { getTotalRep: jest.fn() };

    (getRepository as jest.Mock).mockImplementation((model: unknown) => {
      if (model === SlackUser) return userRepo;
      if (model === Portfolio) return portfolioRepo;
      if (model === PortfolioTransactions) return txRepo;
      return {};
    });
  });

  it('throws when getPortfolio user is missing', async () => {
    userQb.getOne.mockResolvedValue(null);

    await expect(service.getPortfolio('U1', 'T1')).rejects.toThrow('User not found');
  });

  it('creates a portfolio when user has none', async () => {
    userQb.getOne.mockResolvedValue({ slackId: 'U1', portfolio: null });
    portfolioRepo.save.mockResolvedValue({ id: 9 });
    userRepo.save.mockResolvedValue({});

    const out = await service.getPortfolio('U1', 'T1');

    expect(out).toEqual({ id: 9 });
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('returns existing portfolio', async () => {
    userQb.getOne.mockResolvedValue({ slackId: 'U1', portfolio: { id: 3 } });

    await expect(service.getPortfolio('U1', 'T1')).resolves.toEqual({ id: 3 });
  });

  it('transact fails when lock cannot be acquired', async () => {
    txRepo.manager.transaction.mockImplementation(async (callback: unknown) => {
      const cb = callback as TransactionCallback;
      const em = {
        query: jest.fn().mockResolvedValue([{ "GET_LOCK('portfolio_lock_U1', 10)": 0 }]),
      };
      return cb(em);
    });

    await expect(service.transact('U1', 'T1', TransactionType.BUY, 'AAPL', 1, 10)).rejects.toThrow(
      'Another transaction is in progress',
    );
  });

  it('transact fails SELL when shares are insufficient', async () => {
    jest.spyOn(service, 'getPortfolio').mockResolvedValue({ id: 5 } as Portfolio);
    txRepo.manager.transaction.mockImplementation(async (callback: unknown) => {
      const cb = callback as TransactionCallback;
      const shareQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ netQuantity: 1 }),
      };

      const em = {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ "GET_LOCK('portfolio_lock_U1', 10)": 1 }])
          .mockResolvedValueOnce([{ release: 1 }]),
        createQueryBuilder: jest.fn(() => shareQb),
      };
      return cb(em);
    });

    await expect(service.transact('U1', 'T1', TransactionType.SELL, 'AAPL', 2, 10)).rejects.toThrow(
      'Insufficient shares',
    );
  });

  it('transact inserts and releases lock on success', async () => {
    jest.spyOn(service, 'getPortfolio').mockResolvedValue({ id: 5 } as Portfolio);
    txRepo.manager.transaction.mockImplementation(async (callback: unknown) => {
      const cb = callback as TransactionCallback;
      const insertQb = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };

      const em = {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ "GET_LOCK('portfolio_lock_U1', 10)": 1 }])
          .mockResolvedValueOnce([{ release: 1 }]),
        createQueryBuilder: jest.fn(() => insertQb),
      };
      return cb(em);
    });

    const out = await service.transact('U1', 'T1', TransactionType.BUY, 'AAPL', 2, 10);
    expect(out).toEqual({ identifiers: [{ id: 1 }] });
  });

  it('returns empty summary when no transactions exist', async () => {
    jest.spyOn(service, 'getPortfolio').mockResolvedValue({ id: 5 } as Portfolio);
    txQb.getMany.mockResolvedValue([]);
    type PortfolioPersistenceDependencies = PortfolioPersistenceService & {
      reactionPersistenceService: { getTotalRep: jest.Mock };
    };
    (service as unknown as PortfolioPersistenceDependencies).reactionPersistenceService.getTotalRep.mockResolvedValue({
      totalRepAvailable: 4,
    });

    const out = await service.getPortfolioSummary('U1', 'T1');

    expect(out.transactions).toEqual([]);
    expect(out.summary).toEqual([]);
    expect(out.rep.totalRepAvailable).toBe(4);
  });

  it('aggregates BUY and SELL transactions into positive holdings', async () => {
    jest.spyOn(service, 'getPortfolio').mockResolvedValue({ id: 5 } as Portfolio);
    txQb.getMany.mockResolvedValue([
      { assetSymbol: 'AAPL', type: 'BUY', quantity: 5, price: 10 },
      { assetSymbol: 'AAPL', type: 'SELL', quantity: 2, price: 12 },
      { assetSymbol: 'MSFT', type: 'BUY', quantity: 1, price: 30 },
    ]);
    type PortfolioPersistenceDependencies = PortfolioPersistenceService & {
      reactionPersistenceService: { getTotalRep: jest.Mock };
    };
    (service as unknown as PortfolioPersistenceDependencies).reactionPersistenceService.getTotalRep.mockResolvedValue({
      totalRepAvailable: 4,
    });

    const out = await service.getPortfolioSummary('U1', 'T1');

    expect(out.summary).toHaveLength(2);
    expect(out.summary.find((x) => x.symbol === 'AAPL')?.quantity.toString()).toBe('3');
    expect(out.summary.find((x) => x.symbol === 'MSFT')?.quantity.toString()).toBe('1');
  });
});
