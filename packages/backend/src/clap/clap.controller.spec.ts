import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const clap = vi.fn();

vi.mock('./clap.service', async () => ({
  ClapService: classMock(() => ({
    clap,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { clapController } from './clap.controller';

describe('clapController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', clapController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls clap service', async () => {
    await request(app).post('/').send({ text: 'x', user_id: 'U1', response_url: 'url' }).expect(200);
    expect(clap).toHaveBeenCalledWith('x', 'U1', 'url');
  });
});
