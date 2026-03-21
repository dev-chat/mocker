import Decimal from 'decimal.js';
import { MessageHandlerEnum, PortfolioService } from './portfolio.service';
import type { PortfolioSummaryItem} from './portfolio.persistence.service';
import { TransactionType } from './portfolio.persistence.service';

describe('PortfolioService', () => {
  let service: PortfolioService;

  const getQuote = jest.fn();
  const getTotalRep = jest.fn();
  const getPortfolioSummary = jest.fn();
  const transact = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortfolioService();
    type PortfolioServiceDependencies = PortfolioService & {
      quoteService: { getQuote: typeof getQuote };
      repPersistenceService: { getTotalRep: typeof getTotalRep };
      portfolioPersistenceService: {
        getPortfolioSummary: typeof getPortfolioSummary;
        transact: typeof transact;
      };
      isInDST: (date: Date) => boolean;
    };

    const dependencyTarget = service as unknown as PortfolioServiceDependencies;
    dependencyTarget.quoteService = { getQuote };
    dependencyTarget.repPersistenceService = { getTotalRep };
    dependencyTarget.portfolioPersistenceService = {
      getPortfolioSummary,
      transact,
    };
  });

  it('maps quotes with tickers', async () => {
    getQuote.mockResolvedValueOnce({ c: 10 }).mockResolvedValueOnce({ c: 20 });
    const summaryItems: PortfolioSummaryItem[] = [
      { symbol: 'AAPL', quantity: new Decimal(1) },
      { symbol: 'MSFT', quantity: new Decimal(1) },
    ];

    const out = await service.getQuotesWithTicker(summaryItems);

    expect(out).toEqual([
      expect.objectContaining({ ticker: 'AAPL', c: 10 }),
      expect.objectContaining({ ticker: 'MSFT', c: 20 }),
    ]);
  });

  it('builds summary with current quotes', async () => {
    getPortfolioSummary.mockResolvedValue({
      transactions: [],
      summary: [{ symbol: 'AAPL', quantity: 2, costBasis: 20 }],
      rep: { totalRepAvailable: 100 },
    });
    getQuote.mockResolvedValue({ c: 15 });

    const out = await service.getPortfolioSummaryWithQuotes('U1', 'T1');

    expect(out.summary[0]).toEqual(expect.objectContaining({ symbol: 'AAPL' }));
    expect(out.rep.totalRepAvailable).toBe(100);
  });

  it('returns false for weekend trading hours', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-22T15:00:00Z'));

    expect(service.isTradingHours()).toBe(false);
    jest.useRealTimers();
  });

  it('returns true during weekday market hours', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T14:00:00Z'));
    const privateService = service as unknown as { isInDST: (date: Date) => boolean };
    jest.spyOn(privateService, 'isInDST').mockReturnValue(true);

    expect(service.isTradingHours()).toBe(true);
    jest.useRealTimers();
  });

  it('validates stock symbol and quantity inputs', async () => {
    await expect(service.transact('U1', 'T1', 123 as unknown as string, 1, TransactionType.BUY)).resolves.toEqual(
      expect.objectContaining({ classification: MessageHandlerEnum.PRIVATE }),
    );

    await expect(service.transact('U1', 'T1', 'AAPL', 0, TransactionType.BUY)).resolves.toEqual(
      expect.objectContaining({ classification: MessageHandlerEnum.PRIVATE }),
    );
  });

  it('rejects transaction outside trading hours', async () => {
    jest.spyOn(service, 'isTradingHours').mockReturnValue(false);

    const out = await service.transact('U1', 'T1', 'AAPL', 1, TransactionType.BUY);

    expect(out.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(out.message).toContain('trading hours');
  });

  it('returns private error when quote lookup fails', async () => {
    jest.spyOn(service, 'isTradingHours').mockReturnValue(true);
    getQuote.mockRejectedValue(new Error('api fail'));

    const out = await service.transact('U1', 'T1', 'AAPL', 1, TransactionType.BUY);

    expect(out.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(out.message).toContain('Unable to retrieve price');
  });

  it('handles BUY branches: insufficient rep, missing price, success, failure', async () => {
    jest.spyOn(service, 'isTradingHours').mockReturnValue(true);

    getQuote.mockResolvedValueOnce({ c: 20 });
    getTotalRep.mockResolvedValueOnce({ totalRepAvailable: 10 });
    const insufficient = await service.transact('U1', 'T1', 'AAPL', 1, TransactionType.BUY);
    expect(insufficient.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(insufficient.message).toContain('Insufficient rep');

    getQuote.mockResolvedValueOnce({ c: 0 });
    getTotalRep.mockResolvedValueOnce({ totalRepAvailable: 100 });
    const noPrice = await service.transact('U1', 'T1', 'AAPL', 1, TransactionType.BUY);
    expect(noPrice.classification).toBe(MessageHandlerEnum.PRIVATE);

    getQuote.mockResolvedValueOnce({ c: 5 });
    getTotalRep.mockResolvedValueOnce({ totalRepAvailable: 100 });
    transact.mockResolvedValueOnce({});
    const ok = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.BUY);
    expect(ok.classification).toBe(MessageHandlerEnum.PUBLIC);

    getQuote.mockResolvedValueOnce({ c: 5 });
    getTotalRep.mockResolvedValueOnce({ totalRepAvailable: 100 });
    transact.mockRejectedValueOnce(new Error('db fail'));
    const failed = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.BUY);
    expect(failed.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(failed.message).toContain('Transaction failed');
  });

  it('handles SELL branches: insufficient shares, missing price, success, failure', async () => {
    jest.spyOn(service, 'isTradingHours').mockReturnValue(true);

    getQuote.mockResolvedValueOnce({ c: 10 });
    getPortfolioSummary.mockResolvedValueOnce({ transactions: [], summary: [], rep: {} });
    const insufficient = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.SELL);
    expect(insufficient.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(insufficient.message).toContain('Insufficient shares');

    getQuote.mockResolvedValueOnce({ c: 0 });
    getPortfolioSummary.mockResolvedValueOnce({
      transactions: [{ assetSymbol: 'AAPL', type: 'BUY', quantity: 5, price: 10 }],
      summary: [],
      rep: {},
    });
    const noPrice = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.SELL);
    expect(noPrice.classification).toBe(MessageHandlerEnum.PRIVATE);

    getQuote.mockResolvedValueOnce({ c: 12 });
    getPortfolioSummary.mockResolvedValueOnce({
      transactions: [{ assetSymbol: 'AAPL', type: 'BUY', quantity: 5, price: 10 }],
      summary: [],
      rep: {},
    });
    transact.mockResolvedValueOnce({});
    const ok = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.SELL);
    expect(ok.classification).toBe(MessageHandlerEnum.PUBLIC);

    getQuote.mockResolvedValueOnce({ c: 12 });
    getPortfolioSummary.mockResolvedValueOnce({
      transactions: [{ assetSymbol: 'AAPL', type: 'BUY', quantity: 5, price: 10 }],
      summary: [],
      rep: {},
    });
    transact.mockRejectedValueOnce(new Error('db fail'));
    const failed = await service.transact('U1', 'T1', 'AAPL', 2, TransactionType.SELL);
    expect(failed.classification).toBe(MessageHandlerEnum.PRIVATE);
  });

  it('rejects unknown transaction type', async () => {
    jest.spyOn(service, 'isTradingHours').mockReturnValue(true);
    getQuote.mockResolvedValue({ c: 10 });

    const out = await service.transact('U1', 'T1', 'AAPL', 1, 'NOPE' as unknown as TransactionType);

    expect(out.classification).toBe(MessageHandlerEnum.PRIVATE);
    expect(out.message).toContain('Invalid transaction type');
  });
});
