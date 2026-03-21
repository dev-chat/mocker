import express from 'express';
import request from 'supertest';

const clap = jest.fn();

jest.mock('./clap.service', () => ({
  ClapService: jest.fn().mockImplementation(() => ({
    clap,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { clapController } from './clap.controller';

describe('clapController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', clapController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls clap service', async () => {
    await request(app).post('/').send({ text: 'x', user_id: 'U1', response_url: 'url' }).expect(200);
    expect(clap).toHaveBeenCalledWith('x', 'U1', 'url');
  });
});
