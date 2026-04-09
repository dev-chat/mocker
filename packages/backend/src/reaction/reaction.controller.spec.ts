import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const getRep = vi.fn().mockResolvedValue('rep-value');

vi.mock('./reaction.report.service', async () => ({
  ReactionReportService: classMock(() => ({
    getRep,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { reactionController } from './reaction.controller';

describe('reactionController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', reactionController);

  beforeEach(() => vi.clearAllMocks());

  it('returns rep value', async () => {
    getRep.mockResolvedValueOnce('rep-value');
    const body = { user_id: 'U1', team_id: 'T1' };
    const res = await request(app).post('/get').send(body).expect(200);
    expect(res.text).toBe('rep-value');
    expect(getRep).toHaveBeenCalledWith('U1', 'T1');
  });
});
