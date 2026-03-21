import { ItemService } from './item.service';

describe('ItemService', () => {
  let service: ItemService;

  type ItemServiceDependencies = ItemService & {
    webService: { sendMessage: typeof sendMessage };
    suppressorService: {
      isSuppressed: typeof isSuppressed;
      removeSuppression: typeof removeSuppression;
    };
    storeService: {
      useItem: typeof storeUseItem;
      isItemActive: typeof isItemActive;
    };
  };

  const sendMessage = jest.fn();
  const isSuppressed = jest.fn();
  const removeSuppression = jest.fn();
  const storeUseItem = jest.fn();
  const isItemActive = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ItemService();

    (service as unknown as ItemServiceDependencies).webService = { sendMessage };
    (service as unknown as ItemServiceDependencies).suppressorService = { isSuppressed, removeSuppression };
    (service as unknown as ItemServiceDependencies).storeService = {
      useItem: storeUseItem,
      isItemActive,
    };

    // Rebind interactions so they use mocked dependencies above.
    service = new ItemService();
    (service as unknown as ItemServiceDependencies).webService = { sendMessage };
    (service as unknown as ItemServiceDependencies).suppressorService = { isSuppressed, removeSuppression };
    (service as unknown as ItemServiceDependencies).storeService = {
      useItem: storeUseItem,
      isItemActive,
    };
  });

  it('uses item 1 successfully', async () => {
    storeUseItem.mockResolvedValue('ok');

    const result = await service.useItem('1', 'U1', 'T1', 'U2', 'C1');

    expect(storeUseItem).toHaveBeenCalledWith('1', 'U1', 'T1', 'U2');
    expect(result).toBe('ok');
  });

  it('wraps item 1 errors with user-friendly message', async () => {
    storeUseItem.mockRejectedValue(new Error('db'));

    await expect(service.useItem('1', 'U1', 'T1', 'U2', 'C1')).rejects.toThrow(
      'Sorry, unable to set 50 Cal at this time. Please try again later.',
    );
  });

  it('resurrects user for item 3 when target is suppressed', async () => {
    isSuppressed.mockResolvedValue(true);
    removeSuppression.mockResolvedValue(undefined);
    sendMessage.mockResolvedValue({ ok: true });
    storeUseItem.mockResolvedValue('resurrected');

    const result = await service.useItem('3', 'U1', 'T1', 'U2', 'C1');

    expect(removeSuppression).toHaveBeenCalledWith('U2', 'T1');
    expect(sendMessage).toHaveBeenCalledWith('C1', ':zombie: <@U2> has been resurrected by <@U1>! :zombie:');
    expect(storeUseItem).toHaveBeenCalledWith('3', 'U1', 'T1', 'U2');
    expect(result).toBe('resurrected');
  });

  it('rejects item 3 when target user is not suppressed', async () => {
    isSuppressed.mockResolvedValue(false);

    await expect(service.useItem('3', 'U1', 'T1', 'U2', 'C1')).rejects.toThrow(
      'Sorry, the user you are trying to resurrect is not currently dead.',
    );
  });

  it('rejects item 4 when already active', async () => {
    isItemActive.mockResolvedValue(true);

    await expect(service.useItem('4', 'U1', 'T1', 'U2', 'C1')).rejects.toThrow(
      'Sorry, unable to purchase Moon Token at this time. You already have one active.',
    );
  });

  it('returns undefined for unknown item ids', async () => {
    const out = await service.useItem('999', 'U1', 'T1', 'U2', 'C1');

    expect(out).toBeUndefined();
  });
});
