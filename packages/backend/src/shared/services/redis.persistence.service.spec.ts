import { vi } from 'vitest';
import { RedisPersistenceService } from './redis.persistence.service';

type RedisLike = {
  on: Mock;
  get: Mock;
  set: Mock;
  setex: Mock;
  psetex: Mock;
  ttl: Mock;
  expire: Mock;
  subscribe: Mock;
  keys: Mock;
  del: Mock;
};

const getRedis = (): RedisLike => (RedisPersistenceService as unknown as { redis: RedisLike }).redis;

const resetSingleton = () => {
  (RedisPersistenceService as unknown as { instance?: RedisPersistenceService }).instance = undefined;
};

describe('RedisPersistenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSingleton();
  });

  it('returns singleton instance', () => {
    const one = RedisPersistenceService.getInstance();
    const two = RedisPersistenceService.getInstance();

    expect(one).toBe(two);
  });

  it('registers connect handler in constructor', () => {
    const onSpy = vi.spyOn(getRedis(), 'on');

    new RedisPersistenceService();

    expect(onSpy).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('gets value by key', async () => {
    vi.spyOn(getRedis(), 'get').mockResolvedValue('v');
    const service = RedisPersistenceService.getInstance();

    await expect(service.getValue('k')).resolves.toBe('v');
  });

  it('sets value with keep ttl', async () => {
    const setSpy = vi.spyOn(getRedis(), 'set').mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValue('k', 'v')).resolves.toBe('OK');
    expect(setSpy).toHaveBeenCalledWith('k', 'v', 'KEEPTTL');
  });

  it('sets value with EX expiry mode', async () => {
    const setexSpy = vi.spyOn(getRedis(), 'setex').mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValueWithExpire('k', 'v', 'EX', 10)).resolves.toBe('OK');
    expect(setexSpy).toHaveBeenCalledWith('k', 10, 'v');
  });

  it('sets value with PX expiry mode', async () => {
    const psetexSpy = vi.spyOn(getRedis(), 'psetex').mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValueWithExpire('k', 'v', 'PX', 50)).resolves.toBe('OK');
    expect(psetexSpy).toHaveBeenCalledWith('k', 50, 'v');
  });

  it('throws for unknown expiry mode', () => {
    const service = RedisPersistenceService.getInstance();

    expect(() => service.setValueWithExpire('k', 'v', 'BAD', 1)).toThrow('Unknown expiryMode');
  });

  it('wraps ttl, expire, subscribe, keys and del', async () => {
    const ttlSpy = vi.spyOn(getRedis(), 'ttl').mockResolvedValue(42);
    const expireSpy = vi.spyOn(getRedis(), 'expire').mockResolvedValue(1);
    const subscribeSpy = vi.spyOn(getRedis(), 'subscribe').mockResolvedValue(1);
    const keysSpy = vi.spyOn(getRedis(), 'keys').mockResolvedValue(['store.item.user']);
    const delSpy = vi.spyOn(getRedis(), 'del').mockResolvedValue(1);
    const service = RedisPersistenceService.getInstance();

    await expect(service.getTimeRemaining('k')).resolves.toBe(42);
    await expect(service.expire('k', 3)).resolves.toBe(1);
    await expect(service.subscribe('updates')).resolves.toBe(1);
    await expect(service.getPattern('store.item')).resolves.toEqual(['store.item.user']);
    await expect(service.removeKey('k')).resolves.toBe(1);

    expect(ttlSpy).toHaveBeenCalledWith('k');
    expect(expireSpy).toHaveBeenCalledWith('k', 3);
    expect(subscribeSpy).toHaveBeenCalledWith('updates');
    expect(keysSpy).toHaveBeenCalledWith('*store.item*');
    expect(delSpy).toHaveBeenCalledWith('k');
  });
});
