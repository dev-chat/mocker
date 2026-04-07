import { getManager, getRepository } from 'typeorm';
import { Item } from '../shared/db/models/Item';
import { ItemKill } from '../shared/db/models/ItemKill';
import { Purchase } from '../shared/db/models/Purchase';
import { SlackUser } from '../shared/db/models/SlackUser';
import { UsedItem } from '../shared/db/models/UsedItem';
import { StorePersistenceService } from './store.persistence.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
    getManager: jest.fn(),
  };
});

jest.mock('../muzzle/muzzle-utilities', () => ({
  ...jest.requireActual('../muzzle/muzzle-utilities'),
  getMsForSpecifiedRange: jest.fn().mockReturnValue(1000),
}));

describe('StorePersistenceService', () => {
  let service: StorePersistenceService;

  const itemRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };
  const purchaseRepo = {
    insert: jest.fn(),
  };
  const usedItemRepo = {
    insert: jest.fn(),
  };
  const itemKillRepo = {
    insert: jest.fn(),
  };

  const redis = {
    getValue: jest.fn(),
    setValue: jest.fn(),
    setValueWithExpire: jest.fn(),
    getPattern: jest.fn(),
    removeKey: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorePersistenceService();
    type StoreServiceDependencies = StorePersistenceService & {
      redisService: typeof redis;
    };
    (service as unknown as StoreServiceDependencies).redisService = redis;

    (getRepository as jest.Mock).mockImplementation((model: unknown) => {
      if (model === Item) return itemRepo;
      if (model === SlackUser) return userRepo;
      if (model === Purchase) return purchaseRepo;
      if (model === UsedItem) return usedItemRepo;
      if (model === ItemKill) return itemKillRepo;
      return {};
    });
    (getManager as jest.Mock).mockReturnValue({ query: jest.fn() });
  });

  it('gets all items with latest prices', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ price: 5 }])
      .mockResolvedValueOnce([{ price: 9 }]);
    (getManager as jest.Mock).mockReturnValue({ query });
    itemRepo.find.mockResolvedValue([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    const out = await service.getItems('T1');

    expect(out).toEqual([expect.objectContaining({ id: 1, price: 5 }), expect.objectContaining({ id: 2, price: 9 })]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('itemId = ?'), [1, 'T1', 1, 'T1']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('itemId = ?'), [2, 'T1', 2, 'T1']);
  });

  it('returns undefined for NaN item id', async () => {
    await expect(service.getItem(NaN, 'T1')).resolves.toBeUndefined();
    expect(itemRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns item with price for valid id', async () => {
    const query = jest.fn().mockResolvedValue([{ price: 7 }]);
    (getManager as jest.Mock).mockReturnValue({ query });
    itemRepo.findOne.mockResolvedValue({ id: 1, name: 'A' });

    await expect(service.getItem(1, 'T1')).resolves.toEqual(expect.objectContaining({ id: 1, price: 7 }));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('itemId = ?'), [1, 'T1', 1, 'T1']);
  });

  it('checks item activity in redis', async () => {
    redis.getValue.mockResolvedValueOnce('1').mockResolvedValueOnce(null);

    await expect(service.isItemActive('U1', 'T1', 3)).resolves.toBe(true);
    await expect(service.isItemActive('U1', 'T1', 3)).resolves.toBe(false);
  });

  it('returns offensive active items only', async () => {
    itemRepo.find.mockResolvedValue([{ id: 2, isDefensive: true }]);
    redis.getPattern.mockResolvedValue(['store.item.U1-T1.1', 'store.item.U1-T1.2']);

    await expect(service.getActiveItems('U1', 'T1')).resolves.toEqual(['1']);
  });

  it('inserts item kills for active items', async () => {
    itemKillRepo.insert.mockResolvedValue({});

    await service.setItemKill(10, ['2', '3']);

    expect(itemKillRepo.insert).toHaveBeenCalledTimes(2);
    expect(itemKillRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ itemId: 2, muzzleId: 10 }));
  });

  it('sums time modifiers from redis patterns', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 1, isTimeModifier: true, min_modified_ms: 1, max_modified_ms: 2 },
      { id: 2, isTimeModifier: true, min_modified_ms: 1, max_modified_ms: 2 },
    ]);
    redis.getPattern.mockResolvedValueOnce(['k1']).mockResolvedValueOnce(['k2', 'k3']);

    await expect(service.getTimeModifiers('U1', 'T1')).resolves.toBe(3000);
  });

  it('returns active protection key when present', async () => {
    itemRepo.find.mockResolvedValue([{ id: 4, isDefensive: true }]);
    redis.getPattern.mockResolvedValue(['store.item.U1-T1.4']);

    await expect(service.isProtected('U1', 'T1')).resolves.toBe('store.item.U1-T1.4');
  });

  it('returns false when no protection keys are active', async () => {
    itemRepo.find.mockResolvedValue([{ id: 4, isDefensive: true }]);
    redis.getPattern.mockResolvedValue([]);

    await expect(service.isProtected('U1', 'T1')).resolves.toBe(false);
  });

  it('delegates removeKey and getUserOfUsedItem to redis', async () => {
    redis.removeKey.mockResolvedValue(1);
    redis.getValue.mockResolvedValue('U2-T1');

    await expect(service.removeKey('k')).resolves.toBe(1);
    await expect(service.getUserOfUsedItem('k')).resolves.toBe('U2-T1');
  });

  it('buys item successfully and handles purchase insert errors', async () => {
    const query = jest.fn().mockResolvedValue([{ price: 9 }]);
    (getManager as jest.Mock).mockReturnValue({ query });
    itemRepo.findOne.mockResolvedValue({ id: 1, name: 'A' });
    userRepo.findOne.mockResolvedValue({ slackId: 'U1' });

    purchaseRepo.insert.mockResolvedValueOnce({});
    await expect(service.buyItem(1, 'U1', 'T1')).resolves.toContain('Congratulations!');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('itemId = ?'), [1, 'T1', 1, 'T1']);

    purchaseRepo.insert.mockRejectedValueOnce(new Error('insert fail'));
    await expect(service.buyItem(1, 'U1', 'T1')).resolves.toContain('unable to buy A');
  });

  it('returns generic buy error when item or user is missing', async () => {
    const query = jest.fn().mockResolvedValue([{ price: 9 }]);
    (getManager as jest.Mock).mockReturnValue({ query });
    itemRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({ slackId: 'U1' });

    await expect(service.buyItem(1, 'U1', 'T1')).resolves.toContain('unable to buy your item');
  });

  it('uses stackable effect item by extending key suffix', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 1, slackId: 'U1' }).mockResolvedValueOnce({ id: 2, slackId: 'U2' });
    itemRepo.findOne.mockResolvedValue({
      id: 3,
      name: 'thing',
      isEffect: true,
      isStackable: true,
      min_active_ms: 1,
      max_active_ms: 2,
    });
    redis.getPattern.mockResolvedValue(['store.item.U2-T1.3']);
    usedItemRepo.insert.mockResolvedValue({});

    await expect(service.useItem(3, 'U1', 'T1', 'U2')).resolves.toBe('thing used!');
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('store.item.U2-T1.3.1', 'U1-T1', 'PX', 1000);
  });

  it('throws for non-stackable effect item with existing key', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 1, slackId: 'U1' }).mockResolvedValueOnce({ id: 2, slackId: 'U2' });
    itemRepo.findOne.mockResolvedValue({
      id: 3,
      name: 'thing',
      isEffect: true,
      isStackable: false,
      min_active_ms: 1,
      max_active_ms: 2,
    });
    redis.getPattern.mockResolvedValue(['store.item.U2-T1.3']);

    await expect(service.useItem(3, 'U1', 'T1', 'U2')).rejects.toThrow('not stackable');
  });

  it('sets persistent value for non-expiring effect item', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 1, slackId: 'U1' }).mockResolvedValueOnce(null);
    itemRepo.findOne.mockResolvedValue({
      id: 4,
      name: 'shield',
      isEffect: true,
      isStackable: false,
      min_active_ms: 0,
      max_active_ms: 0,
    });
    redis.getPattern.mockResolvedValue([]);
    usedItemRepo.insert.mockResolvedValue({});

    await service.useItem(4, 'U1', 'T1');

    expect(redis.setValue).toHaveBeenCalledWith('store.item.U1-T1.4', 'true');
  });

  it('returns requiresUser value and false when item missing', async () => {
    itemRepo.findOne.mockResolvedValueOnce({ requiresUser: true }).mockResolvedValueOnce(null);

    await expect(service.isUserRequired(1)).resolves.toBe(true);
    await expect(service.isUserRequired(2)).resolves.toBe(false);
  });

  it('builds redis key names with and without item id', () => {
    expect(service.getRedisKeyName('U1', 'T1', 9)).toBe('store.item.U1-T1.9');
    expect(service.getRedisKeyName('U1', 'T1')).toBe('store.item.U1-T1');
  });
});
