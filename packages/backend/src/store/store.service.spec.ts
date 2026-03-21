import { StoreService } from './store.service';

describe('StoreService', () => {
  let service: StoreService;

  type StoreServiceDependencies = StoreService & {
    storePersistenceService: typeof storePersistenceService;
    reactionPersistenceService: typeof reactionPersistenceService;
  };

  const storePersistenceService = {
    getItems: jest.fn(),
    getItem: jest.fn(),
    buyItem: jest.fn(),
    isUserRequired: jest.fn(),
    useItem: jest.fn(),
    isItemActive: jest.fn(),
    getRedisKeyName: jest.fn(),
    removeKey: jest.fn(),
  };

  const reactionPersistenceService = {
    getTotalRep: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreService();
    const dependencyTarget = service as unknown as StoreServiceDependencies;
    dependencyTarget.storePersistenceService = storePersistenceService;
    dependencyTarget.reactionPersistenceService = reactionPersistenceService;
  });

  it('builds store view with items and rep count', async () => {
    storePersistenceService.getItems.mockResolvedValue([
      { id: 1, name: 'A', price: 5, description: 'desc', requiresUser: false },
      { id: 2, name: 'B', price: 7, description: 'desc2', requiresUser: true },
    ]);
    reactionPersistenceService.getTotalRep.mockResolvedValue({ totalRepAvailable: 10 });

    const view = await service.listItems('U1', 'T1');

    expect(view).toContain('Welcome to the Muzzle Store!');
    expect(view).toContain('*1. A*');
    expect(view).toContain('`/use 1`');
    expect(view).toContain('`/use 2 @user`');
    expect(view).toContain('You currently have *10 Rep*');
  });

  it('returns false for invalid item id strings', async () => {
    await expect(service.isValidItem('abc', 'T1')).resolves.toBe(false);
    expect(storePersistenceService.getItem).not.toHaveBeenCalled();
  });

  it('returns true only when item exists', async () => {
    storePersistenceService.getItem.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 1 });

    await expect(service.isValidItem('1', 'T1')).resolves.toBe(false);
    await expect(service.isValidItem('1', 'T1')).resolves.toBe(true);
  });

  it('checks affordability based on rep and price', async () => {
    storePersistenceService.getItem.mockResolvedValue({ price: 7 });
    reactionPersistenceService.getTotalRep
      .mockResolvedValueOnce({ totalRepAvailable: 10 })
      .mockResolvedValueOnce({ totalRepAvailable: 3 });

    await expect(service.canAfford('1', 'U1', 'T1')).resolves.toBe(true);
    await expect(service.canAfford('1', 'U1', 'T1')).resolves.toBe(false);
  });

  it('delegates buyItem and active checks', async () => {
    storePersistenceService.buyItem.mockResolvedValue('receipt');
    storePersistenceService.isItemActive.mockResolvedValue(true);

    await expect(service.buyItem('1', 'U1', 'T1')).resolves.toBe('receipt');
    await expect(service.isItemActive('U1', 'T1', 3)).resolves.toBe(true);
  });

  it('handles user required checks and use item validation', async () => {
    storePersistenceService.isUserRequired.mockResolvedValue(true);
    storePersistenceService.useItem.mockResolvedValue('used');

    await expect(service.isUserRequired(undefined)).resolves.toBe(false);
    await expect(service.isUserRequired('1')).resolves.toBe(true);
    await expect(service.useItem('NaN', 'U1', 'T1')).resolves.toContain('is not a valid item');
    await expect(service.useItem('1', 'U1', 'T1', 'U2')).resolves.toBe('used');
  });

  it('removes effect using redis key name', async () => {
    storePersistenceService.getRedisKeyName.mockReturnValue('store.item.U1-T1.4');
    storePersistenceService.removeKey.mockResolvedValue(1);

    await expect(service.removeEffect('U1', 'T1', 4)).resolves.toBe(1);
    expect(storePersistenceService.getRedisKeyName).toHaveBeenCalledWith('U1', 'T1', 4);
    expect(storePersistenceService.removeKey).toHaveBeenCalledWith('store.item.U1-T1.4');
  });
});
