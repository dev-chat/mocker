import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { SINGLE_DAY_MS } from '../counter/constants';
import { MuzzlePersistenceService } from './muzzle.persistence.service';
import { ABUSE_PENALTY_TIME, MAX_MUZZLES, MuzzleRedisTypeEnum } from './constants';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('MuzzlePersistenceService', () => {
  let service: MuzzlePersistenceService;

  const repo = {
    save: vi.fn(),
    increment: vi.fn(),
    query: vi.fn(),
  };

  const redis = {
    setValue: vi.fn(),
    setValueWithExpire: vi.fn(),
    getValue: vi.fn(),
    removeKey: vi.fn(),
    getTimeRemaining: vi.fn(),
    expire: vi.fn(),
  };

  const storePersistenceService = {
    getActiveItems: vi.fn(),
    setItemKill: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MuzzlePersistenceService();
    type MuzzlePersistenceDependencies = MuzzlePersistenceService & {
      redis: typeof redis;
      storePersistenceService: typeof storePersistenceService;
      getRedisKeyName: (
        userId: string,
        teamId: string,
        userType: MuzzleRedisTypeEnum,
        withSuppressions?: boolean,
      ) => string;
    };
    const dependencyTarget = service as unknown as MuzzlePersistenceDependencies;
    dependencyTarget.redis = redis;
    dependencyTarget.storePersistenceService = storePersistenceService;
    (getRepository as Mock).mockReturnValue(repo);
  });

  it('adds and removes perma muzzle keys', async () => {
    repo.save.mockResolvedValue({ id: 11 });
    redis.getValue.mockResolvedValueOnce('11').mockResolvedValueOnce(null);

    const created = await service.addPermaMuzzle('U1', 'T1');
    expect(created).toEqual({ id: 11 });
    expect(redis.setValue).toHaveBeenCalledWith('muzzle.muzzled.U1-T1', '11');
    expect(redis.setValue).toHaveBeenCalledWith('muzzle.muzzled.U1-T1.suppressions', '0');

    await expect(service.removePermaMuzzle('U1', 'T1')).resolves.toBe(true);
    await expect(service.removePermaMuzzle('U1', 'T1')).resolves.toBe(false);
  });

  it('adds muzzle, sets redis keys, requestor count, and item kills', async () => {
    storePersistenceService.getActiveItems.mockResolvedValue(['1', '2']);
    repo.save.mockResolvedValue({ id: 13 });
    const countSpy = vi.spyOn(service, 'setRequestorCount').mockResolvedValue(undefined);

    const out = await service.addMuzzle('U1', 'U2', 'T1', 10000);

    expect(out).toEqual({ id: 13 });
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('muzzle.muzzled.U2-T1', '13', 'EX', 10);
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('muzzle.muzzled.U2-T1.suppressions', '0', 'EX', 10);
    expect(countSpy).toHaveBeenCalledWith('U1', 'T1');
    expect(storePersistenceService.setItemKill).toHaveBeenCalledWith(13, ['1', '2']);
  });

  it('adds defensive item kill and skips requestor count when defensive item provided', async () => {
    storePersistenceService.getActiveItems.mockResolvedValue([]);
    repo.save.mockResolvedValue({ id: 14 });
    const countSpy = vi.spyOn(service, 'setRequestorCount').mockResolvedValue(undefined);

    await service.addMuzzle('U1', 'U2', 'T1', 10000, '99');

    expect(countSpy).not.toHaveBeenCalled();
    expect(storePersistenceService.setItemKill).toHaveBeenCalledWith(14, ['99']);
  });

  it('removes muzzle and muzzle privileges', async () => {
    await service.removeMuzzle('U2', 'T1');
    expect(redis.removeKey).toHaveBeenCalledWith('muzzle.muzzled.U2-T1');

    service.removeMuzzlePrivileges('U1', 'T1');
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('muzzle.requestor.U1-T1', '2', 'PX', SINGLE_DAY_MS);
  });

  it('sets requestor count with expire on first, increments before max, stops at max', async () => {
    redis.getValue.mockResolvedValueOnce(null).mockResolvedValueOnce('1').mockResolvedValueOnce(String(MAX_MUZZLES));

    await service.setRequestorCount('U1', 'T1');
    expect(redis.setValueWithExpire).toHaveBeenCalledWith('muzzle.requestor.U1-T1', '1', 'EX', expect.any(Number));

    await service.setRequestorCount('U1', 'T1');
    expect(redis.setValue).toHaveBeenCalledWith('muzzle.requestor.U1-T1', 2);

    await service.setRequestorCount('U1', 'T1');
    expect(redis.setValue).toHaveBeenCalledTimes(1);
  });

  it('checks max muzzles reached', async () => {
    redis.getValue.mockResolvedValueOnce(String(MAX_MUZZLES)).mockResolvedValueOnce('1').mockResolvedValueOnce(null);

    await expect(service.isMaxMuzzlesReached('U1', 'T1')).resolves.toBe(true);
    await expect(service.isMaxMuzzlesReached('U1', 'T1')).resolves.toBe(false);
    await expect(service.isMaxMuzzlesReached('U1', 'T1')).resolves.toBe(false);
  });

  it('adds muzzle time when muzzled id exists', async () => {
    redis.getValue.mockResolvedValue('12');
    redis.getTimeRemaining.mockResolvedValue(10);
    const incSpy = vi.spyOn(service, 'incrementMuzzleTime').mockResolvedValue({ affected: 1 } as never);

    await service.addMuzzleTime('U1', 'T1', 5000);

    expect(incSpy).toHaveBeenCalledWith(12, ABUSE_PENALTY_TIME);
    expect(redis.expire).toHaveBeenCalledWith('muzzle.muzzled.U1-T1', 15);
  });

  it('skips addMuzzleTime when not muzzled', async () => {
    redis.getValue.mockResolvedValue(null);

    await service.addMuzzleTime('U1', 'T1', 5000);
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('gets muzzle and suppressions state', async () => {
    redis.getValue
      .mockResolvedValueOnce('9')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('2')
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce(null);

    await expect(service.getMuzzle('U1', 'T1')).resolves.toBe(9);
    await expect(service.getMuzzle('U1', 'T1')).resolves.toBeUndefined();
    await expect(service.getSuppressions('U1', 'T1')).resolves.toBe('2');
    await expect(service.isUserMuzzled('U1', 'T1')).resolves.toBe(true);
    await expect(service.isUserMuzzled('U1', 'T1')).resolves.toBe(false);
  });

  it('increments stateful suppressions from existing or initializes to one', async () => {
    redis.getValue.mockResolvedValueOnce('3').mockResolvedValueOnce(null);

    await service.incrementStatefulSuppressions('U1', 'T1');
    expect(redis.setValue).toHaveBeenCalledWith('muzzle.muzzled.U1-T1.suppressions', '4');

    await service.incrementStatefulSuppressions('U1', 'T1');
    expect(redis.setValue).toHaveBeenCalledWith('muzzle.muzzled.U1-T1.suppressions', '1');
  });

  it('increments suppression counters and tracks deleted message', async () => {
    repo.increment.mockResolvedValue({ affected: 1 });

    await service.incrementMuzzleTime(1, 1000);
    await service.incrementMessageSuppressions(1);
    await service.incrementWordSuppressions(1, 3);
    await service.incrementCharacterSuppressions(1, 10);

    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'milliseconds', 1000);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'messagesSuppressed', 1);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'wordsSuppressed', 3);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'charactersSuppressed', 10);

    const msgSpy = vi.spyOn(service, 'incrementMessageSuppressions').mockResolvedValue({ affected: 1 } as never);
    const wordSpy = vi.spyOn(service, 'incrementWordSuppressions').mockResolvedValue({ affected: 1 } as never);
    const charSpy = vi.spyOn(service, 'incrementCharacterSuppressions').mockResolvedValue({ affected: 1 } as never);

    service.trackDeletedMessage(7, 'hello world');
    expect(msgSpy).toHaveBeenCalledWith(7);
    expect(wordSpy).toHaveBeenCalledWith(7, 2);
    expect(charSpy).toHaveBeenCalledWith(7, 11);

    msgSpy.mockClear();
    service.trackDeletedMessage(7);
    expect(msgSpy).not.toHaveBeenCalled();
  });

  it('gets muzzle count by time period', async () => {
    repo.query.mockResolvedValueOnce([{ count: '4' }]).mockResolvedValueOnce([{}]);

    await expect(service.getMuzzlesByTimePeriod('U1', 'T1', 's', 'e')).resolves.toBe(4);
    await expect(service.getMuzzlesByTimePeriod('U1', 'T1', 's', 'e')).resolves.toBe(0);
  });

  it('builds redis key names for all enum types', () => {
    type MuzzlePrivateAccess = MuzzlePersistenceService & {
      getRedisKeyName: (
        userId: string,
        teamId: string,
        userType: MuzzleRedisTypeEnum,
        withSuppressions?: boolean,
      ) => string;
    };
    const key = (service as unknown as MuzzlePrivateAccess).getRedisKeyName(
      'U1',
      'T1',
      MuzzleRedisTypeEnum.Muzzled,
      true,
    );
    expect(key).toBe('muzzle.muzzled.U1-T1.suppressions');
  });
});
