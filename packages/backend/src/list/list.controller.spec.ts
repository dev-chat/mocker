import express from 'express';
import request from 'supertest';

const getListReport = jest.fn();
const list = jest.fn();
const remove = jest.fn();

jest.mock('./list.service', () => ({
  ListService: jest.fn().mockImplementation(() => ({
    getListReport,
    list,
    remove,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { listController } from './list.controller';

describe('listController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', listController);

  beforeEach(() => jest.clearAllMocks());

  it('handles retrieve', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: '' };
    await request(app).post('/retrieve').send(body).expect(200);
    expect(getListReport).toHaveBeenCalledWith(body);
  });

  it('handles add', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'foo' };
    await request(app).post('/add').send(body).expect(200);
    expect(list).toHaveBeenCalledWith(body);
  });

  it('handles remove', async () => {
    const body = { user_id: 'U1', team_id: 'T1', text: 'foo' };
    await request(app).post('/remove').send(body).expect(200);
    expect(remove).toHaveBeenCalledWith(body);
  });
});
