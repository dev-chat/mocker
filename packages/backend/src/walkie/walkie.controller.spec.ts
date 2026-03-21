import express from 'express';
import request from 'supertest';

const walkieTalkie = jest.fn();

jest.mock('./walkie.service', () => ({
  WalkieService: jest.fn().mockImplementation(() => ({
    walkieTalkie,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { walkieController } from './walkie.controller';

describe('walkieController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', walkieController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls walkie service', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'hello' };
    await request(app).post('/').send(body).expect(200);
    expect(walkieTalkie).toHaveBeenCalledWith(body);
  });
});
