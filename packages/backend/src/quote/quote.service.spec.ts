import { vi } from 'vitest';
import Axios from 'axios';
import { QuoteService } from './quote.service';
import type { CompanyProfile, MetricResponse, QuoteResponse } from './quote.models';

type QuoteServiceDependencies = QuoteService & {
  webService: { sendMessage: Mock };
};

vi.mock('axios');

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    sendMessage: vi.fn(),
  })),
}));

describe('QuoteService', () => {
  let service: QuoteService;
  let sendMessage: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuoteService();
    sendMessage = (service as unknown as QuoteServiceDependencies).webService.sendMessage;
  });

  it('formats market cap in trillions and billions', () => {
    expect(service.getMarketCap(200, 10000)).toContain('T');
    expect(service.getMarketCap(10, 100)).toContain('B');
  });

  it('formats quote data and 52 week bounds', () => {
    const out = service.formatData(
      { h: 50, l: 10, c: 20, dp: 2, d: 1, pc: 19 } as QuoteResponse,
      { metric: { '52WeekHigh': 45, '52WeekLow': 12 } } as MetricResponse,
      { shareOutstanding: 1000, name: 'Acme' } as CompanyProfile,
      'acme',
    );

    expect(out['52WeekHigh']).toBe('50.00');
    expect(out['52WeekLow']).toBe('10.00');
    expect(out.name).toBe('Acme');
    expect(out.deltaPercent).toBe('2.00%');
  });

  it('returns emoji and +/- prefixes correctly', () => {
    expect(service.getEmoji('1')).toContain('upwards');
    expect(service.getEmoji('-1')).toContain('downwards');
    expect(service.getEmoji('0')).toContain(':chart:');
    expect(service.getPlusOrMinus('1')).toBe('+');
    expect(service.getPlusOrMinus('-1')).toBe('');
    expect(service.getPlusOrMinusPercent('1')).toBe('+');
    expect(service.getPlusOrMinusPercent('0')).toBe('');
  });

  it('creates quote blocks containing header and requester context', () => {
    const blocks = service.createQuoteBlocks(
      {
        ticker: 'aapl',
        name: 'Apple',
        close: '100.00',
        delta: '1.00',
        deltaPercent: '1.00%',
        prevClose: '99.00',
        marketCap: '3.00T',
        high: '101.00',
        low: '98.00',
        '52WeekHigh': '120.00',
        '52WeekLow': '80.00',
        lastRefreshed: new Date(),
      },
      'U1',
    ) as unknown[];

    expect(blocks[0].type).toBe('header');
    expect(blocks[0].text.text).toContain('AAPL');
    expect(blocks[blocks.length - 1].elements[0].text).toContain('<@U1>');
  });

  it('fetches quote, metrics and profile payloads', async () => {
    (Axios.get as Mock)
      .mockResolvedValueOnce({ data: { c: 1 } })
      .mockResolvedValueOnce({ data: { metric: {} } })
      .mockResolvedValueOnce({ data: { name: 'X' } });

    await expect(service.getQuote('aapl')).resolves.toEqual({ c: 1 });
    await expect(service.getMetrics('aapl')).resolves.toEqual({ metric: {} });
    await expect(service.getCompanyProfile('aapl')).resolves.toEqual({ name: 'X' });
    expect(Axios.get).toHaveBeenCalledTimes(3);
  });

  it('sends quote blocks on successful fetch', async () => {
    vi.spyOn(service, 'getQuote').mockResolvedValue({ h: 50, l: 10, c: 20, dp: 2, d: 1, pc: 19 } as QuoteResponse);
    vi.spyOn(service, 'getMetrics').mockResolvedValue({
      metric: { '52WeekHigh': 45, '52WeekLow': 12 },
    } as MetricResponse);
    vi.spyOn(service, 'getCompanyProfile').mockResolvedValue({
      shareOutstanding: 1000,
      name: 'Acme',
    } as CompanyProfile);
    sendMessage.mockResolvedValue({ ok: true });

    await service.quote('aapl', 'C1', 'U1');

    expect(sendMessage).toHaveBeenCalledWith('C1', '', expect.any(Array));
  });

  it('sends DM fallback when channel send fails', async () => {
    vi.spyOn(service, 'getQuote').mockResolvedValue({ h: 50, l: 10, c: 20, dp: 2, d: 1, pc: 19 } as QuoteResponse);
    vi.spyOn(service, 'getMetrics').mockResolvedValue({
      metric: { '52WeekHigh': 45, '52WeekLow': 12 },
    } as MetricResponse);
    vi.spyOn(service, 'getCompanyProfile').mockResolvedValue({
      shareOutstanding: 1000,
      name: 'Acme',
    } as CompanyProfile);
    sendMessage.mockRejectedValueOnce(new Error('slack fail')).mockResolvedValueOnce({ ok: true });

    await service.quote('aapl', 'C1', 'U1');
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith('U1', expect.stringContaining('unable to send the requested text'));
  });

  it('sends generic failure message when fetch fails', async () => {
    vi.spyOn(service, 'getQuote').mockRejectedValue(new Error('api down'));
    vi.spyOn(service, 'getMetrics').mockResolvedValue({
      metric: { '52WeekHigh': 45, '52WeekLow': 12 },
    } as MetricResponse);
    vi.spyOn(service, 'getCompanyProfile').mockResolvedValue({
      shareOutstanding: 1000,
      name: 'Acme',
    } as CompanyProfile);
    sendMessage.mockResolvedValue({ ok: true });

    await service.quote('aapl', 'C1', 'U1');

    expect(sendMessage).toHaveBeenCalledWith('U1', expect.stringContaining('something went wrong'));
  });
});
