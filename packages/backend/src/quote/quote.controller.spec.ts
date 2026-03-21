import express from 'express';
import request from 'supertest';

const quote = jest.fn();

jest.mock('./quote.service', () => ({
  QuoteService: jest.fn().mockImplementation(() => ({
    quote,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { quoteController } from './quote.controller';

describe('quoteController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', quoteController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls quote service with uppercase symbol', async () => {
    await request(app).post('/').send({ text: 'aapl', channel_id: 'C1', user_id: 'U1' }).expect(200);
    expect(quote).toHaveBeenCalledWith('AAPL', 'C1', 'U1');
  });
});
