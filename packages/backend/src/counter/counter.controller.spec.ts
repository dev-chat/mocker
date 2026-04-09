import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { canCounter, createCounter } = vi.hoisted(() => ({
  canCounter: vi.fn(),
  createCounter: vi.fn(),
}));

vi.mock('./counter.persistence.service', async () => ({
  CounterPersistenceService: {
    getInstance: vi.fn(() => ({
      canCounter,
    })),
  },
}));

vi.mock('./counter.service', async () => ({
  CounterService: classMock(() => ({
    createCounter,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { counterController } from './counter.controller';

describe('counterController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', counterController);

  beforeEach(() => {
    vi.clearAllMocks();
    canCounter.mockReturnValue(true);
    createCounter.mockResolvedValue('Counter created');
  });

  it('rejects when user cannot counter', async () => {
    canCounter.mockReturnValue(false);
    const res = await request(app).post('/').send({ user_id: 'U1', team_id: 'T1' }).expect(200);
    expect(res.text).toContain('lost counter privileges');
  });

  it('returns created response when createCounter succeeds', async () => {
    const res = await request(app).post('/').send({ user_id: 'U1', team_id: 'T1' }).expect(200);
    expect(res.text).toBe('Counter created');
    expect(createCounter).toHaveBeenCalledWith('U1', 'T1');
  });

  it('returns error text when createCounter fails', async () => {
    createCounter.mockRejectedValueOnce('counter failed');
    const res = await request(app).post('/').send({ user_id: 'U1', team_id: 'T1' }).expect(200);
    expect(res.text).toBe('counter failed');
  });
});
