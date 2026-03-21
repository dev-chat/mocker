import express from 'express';
import request from 'supertest';

const mockFn = jest.fn();

jest.mock('./mock.service', () => ({
  MockService: jest.fn().mockImplementation(() => ({
    mock: mockFn,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { mockController } from './mock.controller';

describe('mockController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', mockController);

  beforeEach(() => jest.clearAllMocks());

  it('handles post and calls mock service', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'hello' };
    await request(app).post('/').send(body).expect(200);
    expect(mockFn).toHaveBeenCalledWith(body);
  });
});
