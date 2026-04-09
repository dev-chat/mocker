import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const listItems = vi.fn();
const isValidItem = vi.fn();
const canAfford = vi.fn();
const isUserRequired = vi.fn();
const buyItem = vi.fn();
const useItem = vi.fn();
const getUserId = vi.fn();

vi.mock('./store.service', async () => ({
  StoreService: classMock(() => ({
    listItems,
    isValidItem,
    canAfford,
    isUserRequired,
    buyItem,
  })),
}));

vi.mock('./item.service', async () => ({
  ItemService: classMock(() => ({
    useItem,
  })),
}));

vi.mock('../shared/services/suppressor.service', async () => ({
  SuppressorService: classMock(() => ({
    slackService: { getUserId },
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { storeController } from './store.controller';

describe('storeController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', storeController);

  beforeEach(() => {
    vi.clearAllMocks();
    listItems.mockResolvedValue('items');
    isValidItem.mockResolvedValue(true);
    canAfford.mockResolvedValue(true);
    isUserRequired.mockResolvedValue(false);
    buyItem.mockResolvedValue('receipt');
    useItem.mockResolvedValue('used');
    getUserId.mockResolvedValue('U2');
  });

  it('lists store items', async () => {
    const res = await request(app).post('/').send({ user_id: 'U1', team_id: 'T1' }).expect(200);
    expect(res.text).toBe('items');
  });

  it('rejects invalid item', async () => {
    isValidItem.mockResolvedValue(false);
    const res = await request(app).post('/use').send({ user_id: 'U1', team_id: 'T1', text: 'bad' }).expect(200);
    expect(res.text).toContain('Invalid item');
  });

  it('rejects unaffordable item', async () => {
    canAfford.mockResolvedValue(false);
    const res = await request(app).post('/use').send({ user_id: 'U1', team_id: 'T1', text: 'item1' }).expect(200);
    expect(res.text).toContain("can't afford");
  });

  it('rejects when user-required item missing target user', async () => {
    isUserRequired.mockResolvedValue(true);
    const res = await request(app).post('/use').send({ user_id: 'U1', team_id: 'T1', text: 'item1' }).expect(200);
    expect(res.text).toContain('only be used on other people');
  });

  it('uses and buys item successfully', async () => {
    isUserRequired.mockResolvedValue(true);
    const res = await request(app)
      .post('/use')
      .send({ user_id: 'U1', team_id: 'T1', text: 'item1 @user', channel_name: 'C1' })
      .expect(200);

    expect(useItem).toHaveBeenCalled();
    expect(buyItem).toHaveBeenCalled();
    expect(res.text).toBe('used');
  });
});
