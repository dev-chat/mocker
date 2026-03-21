import express from 'express';
import request from 'supertest';

const getRep = jest.fn().mockResolvedValue('rep-value');

jest.mock('./reaction.report.service', () => ({
  ReactionReportService: jest.fn().mockImplementation(() => ({
    getRep,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { reactionController } from './reaction.controller';

describe('reactionController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', reactionController);

  beforeEach(() => jest.clearAllMocks());

  it('returns rep value', async () => {
    getRep.mockResolvedValueOnce('rep-value');
    const body = { user_id: 'U1', team_id: 'T1' };
    const res = await request(app).post('/get').send(body).expect(200);
    expect(res.text).toBe('rep-value');
    expect(getRep).toHaveBeenCalledWith('U1', 'T1');
  });
});
