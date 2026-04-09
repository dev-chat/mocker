import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const confess = vi.fn();

vi.mock('./confession.service', async () => ({
  ConfessionService: classMock(() => ({
    confess,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { confessionController } from './confession.controller';

describe('confessionController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', confessionController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls confess', async () => {
    await request(app).post('/').send({ user_id: 'U1', channel_id: 'C1', text: 'secret' }).expect(200);
    expect(confess).toHaveBeenCalledWith('U1', 'C1', 'secret');
  });
});
