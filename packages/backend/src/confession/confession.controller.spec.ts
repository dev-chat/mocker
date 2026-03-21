import express from 'express';
import request from 'supertest';

const confess = jest.fn();

jest.mock('./confession.service', () => ({
  ConfessionService: jest.fn().mockImplementation(() => ({
    confess,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { confessionController } from './confession.controller';

describe('confessionController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', confessionController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls confess', async () => {
    await request(app).post('/').send({ user_id: 'U1', channel_id: 'C1', text: 'secret' }).expect(200);
    expect(confess).toHaveBeenCalledWith('U1', 'C1', 'secret');
  });
});
