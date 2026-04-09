import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const getListReport = vi.fn();
const list = vi.fn();
const remove = vi.fn();

vi.mock('./list.service', async () => ({
  ListService: classMock(() => ({
    getListReport,
    list,
    remove,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { listController } from './list.controller';

describe('listController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', listController);

  beforeEach(() => vi.clearAllMocks());

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
