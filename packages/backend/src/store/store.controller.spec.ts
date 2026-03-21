import express from 'express';
import request from 'supertest';

const listItems = jest.fn();
const isValidItem = jest.fn();
const canAfford = jest.fn();
const isUserRequired = jest.fn();
const buyItem = jest.fn();
const useItem = jest.fn();
const getUserId = jest.fn();

jest.mock('./store.service', () => ({
  StoreService: jest.fn().mockImplementation(() => ({
    listItems,
    isValidItem,
    canAfford,
    isUserRequired,
    buyItem,
  })),
}));

jest.mock('./item.service', () => ({
  ItemService: jest.fn().mockImplementation(() => ({
    useItem,
  })),
}));

jest.mock('../shared/services/suppressor.service', () => ({
  SuppressorService: jest.fn().mockImplementation(() => ({
    slackService: { getUserId },
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { storeController } from './store.controller';

describe('storeController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', storeController);

  beforeEach(() => {
    jest.clearAllMocks();
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
