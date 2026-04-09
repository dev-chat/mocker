import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const define = vi.fn().mockResolvedValue(undefined);

vi.mock('./define.service', async () => ({
  DefineService: classMock(() => ({
    define,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { defineController } from './define.controller';

describe('defineController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', defineController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls define', async () => {
    await request(app).post('/').send({ user_id: 'U1', channel_id: 'C1', text: 'word' }).expect(200);
    expect(define).toHaveBeenCalledWith('word', 'U1', 'C1');
  });
});
