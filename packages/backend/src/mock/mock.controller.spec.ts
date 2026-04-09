import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockFn = vi.fn();

vi.mock('./mock.service', async () => ({
  MockService: classMock(() => ({
    mock: mockFn,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { mockController } from './mock.controller';

describe('mockController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', mockController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls mock service', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'hello' };
    await request(app).post('/').send(body).expect(200);
    expect(mockFn).toHaveBeenCalledWith(body);
  });
});
