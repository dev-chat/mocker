import express from 'express';
import request from 'supertest';

const define = jest.fn().mockResolvedValue(undefined);

jest.mock('./define.service', () => ({
  DefineService: jest.fn().mockImplementation(() => ({
    define,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { defineController } from './define.controller';

describe('defineController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', defineController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls define', async () => {
    await request(app).post('/').send({ user_id: 'U1', channel_id: 'C1', text: 'word' }).expect(200);
    expect(define).toHaveBeenCalledWith('word', 'U1', 'C1');
  });
});
