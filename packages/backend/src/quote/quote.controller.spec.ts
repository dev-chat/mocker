import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const quote = vi.fn();

vi.mock('./quote.service', async () => ({
  QuoteService: classMock(() => ({
    quote,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { quoteController } from './quote.controller';

describe('quoteController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', quoteController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls quote service with uppercase symbol', async () => {
    await request(app).post('/').send({ text: 'aapl', channel_id: 'C1', user_id: 'U1' }).expect(200);
    expect(quote).toHaveBeenCalledWith('AAPL', 'C1', 'U1');
  });
});
