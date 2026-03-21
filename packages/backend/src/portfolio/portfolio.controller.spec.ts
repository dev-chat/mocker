import express from 'express';
import request from 'supertest';
import Decimal from 'decimal.js';

const transact = jest.fn();
const getPortfolioSummaryWithQuotes = jest.fn();
const sendMessage = jest.fn();
const sendEphemeral = jest.fn();

jest.mock('./portfolio.service', () => ({
  PortfolioService: jest.fn().mockImplementation(() => ({
    transact,
    getPortfolioSummaryWithQuotes,
  })),
}));

jest.mock('../shared/services/web/web.service', () => ({
  WebService: jest.fn().mockImplementation(() => ({
    sendMessage,
    sendEphemeral,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { portfolioController } from './portfolio.controller';

describe('portfolioController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', portfolioController);

  beforeEach(() => {
    jest.clearAllMocks();
    transact.mockResolvedValue({ classification: 'PUBLIC', message: 'done' });
    getPortfolioSummaryWithQuotes.mockResolvedValue({
      summary: [
        {
          symbol: 'AAPL',
          quantity: new Decimal(2),
          currentPrice: new Decimal(100),
          costBasis: new Decimal(150),
        },
      ],
      rep: { totalRepAvailable: new Decimal(50) },
    });
  });

  it('handles buy route', async () => {
    await request(app)
      .post('/buy')
      .send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'AAPL 1' })
      .expect(200);
    expect(transact).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith('C1', 'done');
  });

  it('handles sell route and private response', async () => {
    transact.mockResolvedValueOnce({ classification: 'PRIVATE', message: 'hidden' });
    await request(app)
      .post('/sell')
      .send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'AAPL 1' })
      .expect(200);
    expect(sendEphemeral).toHaveBeenCalledWith('C1', 'hidden', 'U1');
  });

  it('handles summary route', async () => {
    await request(app).post('/summary').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1' }).expect(200);
    expect(getPortfolioSummaryWithQuotes).toHaveBeenCalledWith('U1', 'T1');
    expect(sendEphemeral).toHaveBeenCalled();
  });
});
