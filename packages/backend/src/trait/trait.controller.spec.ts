import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { sendTraitsForUser } = vi.hoisted(() => ({
  sendTraitsForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./trait.service', async () => ({
  TraitService: classMock(() => ({
    sendTraitsForUser,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { traitController } from './trait.controller';

describe('traitController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', traitController);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles /traits and responds immediately', async () => {
    await request(app).post('/').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1' }).expect(200, '');

    expect(sendTraitsForUser).toHaveBeenCalledWith('U1', 'T1', 'C1');
  });
});
