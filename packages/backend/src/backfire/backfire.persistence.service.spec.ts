import { getRepository } from 'typeorm';
import { BackFirePersistenceService } from './backfire.persistence.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('BackFirePersistenceService', () => {
  let service: BackFirePersistenceService;

  type BackfirePersistenceDependencies = BackFirePersistenceService & {
    redis: typeof redis;
  };

  const save = jest.fn();
  const increment = jest.fn();

  const redis = {
    setValueWithExpire: jest.fn(),
    removeKey: jest.fn(),
    getValue: jest.fn(),
    setValue: jest.fn(),
    getTimeRemaining: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BackFirePersistenceService();
    (service as unknown as BackfirePersistenceDependencies).redis = redis;
    (getRepository as jest.Mock).mockReturnValue({ save, increment });
  });

  it('adds backfire and stores redis keys with expiry', async () => {
    save.mockResolvedValue({ id: 11 });

    await service.addBackfire('U1', 60000, 'T1');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ muzzledId: 'U1', milliseconds: 60000, teamId: 'T1', messagesSuppressed: 0 }),
    );
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('backfire.U1-T1', 11, 'EX', 60);
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('backfire.U1-T1.suppressions', 0, 'EX', 60);
  });

  it('removes backfire from redis', async () => {
    redis.removeKey.mockResolvedValue(1);

    await service.removeBackfire('U1', 'T1');

    expect(redis.removeKey).toHaveBeenCalledWith('backfire.U1-T1');
  });

  it('checks if backfire exists', async () => {
    redis.getValue.mockResolvedValueOnce('1').mockResolvedValueOnce(null);

    await expect(service.isBackfire('U1', 'T1')).resolves.toBe(true);
    await expect(service.isBackfire('U1', 'T1')).resolves.toBe(false);
  });

  it('gets suppressions and increments suppression counter', async () => {
    redis.getValue.mockResolvedValue('2');

    await expect(service.getSuppressions('U1', 'T1')).resolves.toBe('2');
    await service.addSuppression('U1', 'T1');

    expect(redis.setValue).toHaveBeenCalledWith('backfire.U1-T1.suppressions', 3);
  });

  it('adds backfire time and increments db duration when active', async () => {
    jest.spyOn(service, 'isBackfire').mockResolvedValue(true);
    redis.getTimeRemaining.mockResolvedValue(10);
    redis.expire.mockResolvedValue(1);
    redis.getValue.mockResolvedValue('9');
    const incrementSpy = jest.spyOn(service, 'incrementBackfireTime').mockResolvedValue({ affected: 1 } as never);

    await service.addBackfireTime('U1', 'T1', 5000);

    expect(redis.expire).toHaveBeenCalledWith('backfire.U1-T1', 15);
    expect(redis.expire).toHaveBeenCalledWith('backfire.U1-T1.suppressions', 15);
    expect(incrementSpy).toHaveBeenCalledWith(9, 5000);
  });

  it('skips addBackfireTime when no active backfire', async () => {
    jest.spyOn(service, 'isBackfire').mockResolvedValue(false);

    await service.addBackfireTime('U1', 'T1', 5000);

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('parses backfire id from redis', async () => {
    redis.getValue.mockResolvedValueOnce('5').mockResolvedValueOnce(null);

    await expect(service.getBackfireByUserId('U1', 'T1')).resolves.toBe(5);
    await expect(service.getBackfireByUserId('U1', 'T1')).resolves.toBeUndefined();
  });

  it('tracks deleted message stats when text is provided', () => {
    const msgSpy = jest.spyOn(service, 'incrementMessageSuppressions').mockResolvedValue({ affected: 1 } as never);
    const wordSpy = jest.spyOn(service, 'incrementWordSuppressions').mockResolvedValue({ affected: 1 } as never);
    const charSpy = jest.spyOn(service, 'incrementCharacterSuppressions').mockResolvedValue({ affected: 1 } as never);

    service.trackDeletedMessage(7, 'hello world');

    expect(msgSpy).toHaveBeenCalledWith(7);
    expect(wordSpy).toHaveBeenCalledWith(7, 2);
    expect(charSpy).toHaveBeenCalledWith(7, 11);
  });

  it('does not track deleted message stats when text is empty', () => {
    const msgSpy = jest.spyOn(service, 'incrementMessageSuppressions').mockResolvedValue({ affected: 1 } as never);

    service.trackDeletedMessage(7);

    expect(msgSpy).not.toHaveBeenCalled();
  });

  it('increments db counters for time/messages/words/chars', async () => {
    increment.mockResolvedValue({ affected: 1 });

    await service.incrementBackfireTime(1, 1000);
    await service.incrementMessageSuppressions(1);
    await service.incrementWordSuppressions(1, 4);
    await service.incrementCharacterSuppressions(1, 10);

    expect(increment).toHaveBeenCalledWith({ id: 1 }, 'milliseconds', 1000);
    expect(increment).toHaveBeenCalledWith({ id: 1 }, 'messagesSuppressed', 1);
    expect(increment).toHaveBeenCalledWith({ id: 1 }, 'wordsSuppressed', 4);
    expect(increment).toHaveBeenCalledWith({ id: 1 }, 'charactersSuppressed', 10);
  });
});
