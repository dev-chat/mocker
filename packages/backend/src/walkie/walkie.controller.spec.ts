import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const walkieTalkie = vi.fn();

vi.mock('./walkie.service', async () => ({
  WalkieService: classMock(() => ({
    walkieTalkie,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { walkieController } from './walkie.controller';

describe('walkieController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', walkieController);

  beforeEach(() => vi.clearAllMocks());

  it('handles post and calls walkie service', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'hello' };
    await request(app).post('/').send(body).expect(200);
    expect(walkieTalkie).toHaveBeenCalledWith(body);
  });
});
