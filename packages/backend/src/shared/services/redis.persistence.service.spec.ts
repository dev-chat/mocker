const mockRedisInstance = {
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  psetex: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  subscribe: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
};

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => mockRedisInstance),
  };
});

import { RedisPersistenceService } from './redis.persistence.service';

describe('RedisPersistenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns singleton instance', () => {
    const one = RedisPersistenceService.getInstance();
    const two = RedisPersistenceService.getInstance();

    expect(one).toBe(two);
  });

  it('registers connect handler in constructor', () => {
    new RedisPersistenceService();

    expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('gets value by key', async () => {
    mockRedisInstance.get.mockResolvedValue('v');
    const service = RedisPersistenceService.getInstance();

    await expect(service.getValue('k')).resolves.toBe('v');
  });

  it('sets value with keep ttl', async () => {
    mockRedisInstance.set.mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValue('k', 'v')).resolves.toBe('OK');
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v', 'KEEPTTL');
  });

  it('sets value with EX expiry mode', async () => {
    mockRedisInstance.setex.mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValueWithExpire('k', 'v', 'EX', 10)).resolves.toBe('OK');
    expect(mockRedisInstance.setex).toHaveBeenCalledWith('k', 10, 'v');
  });

  it('sets value with PX expiry mode', async () => {
    mockRedisInstance.psetex.mockResolvedValue('OK');
    const service = RedisPersistenceService.getInstance();

    await expect(service.setValueWithExpire('k', 'v', 'PX', 50)).resolves.toBe('OK');
    expect(mockRedisInstance.psetex).toHaveBeenCalledWith('k', 50, 'v');
  });

  it('throws for unknown expiry mode', async () => {
    const service = RedisPersistenceService.getInstance();

    expect(() => service.setValueWithExpire('k', 'v', 'BAD', 1)).toThrow('Unknown expiryMode');
  });

  it('wraps ttl, expire, subscribe, keys and del', async () => {
    mockRedisInstance.ttl.mockResolvedValue(42);
    mockRedisInstance.expire.mockResolvedValue(1);
    mockRedisInstance.subscribe.mockResolvedValue(1);
    mockRedisInstance.keys.mockResolvedValue(['store.item.user']);
    mockRedisInstance.del.mockResolvedValue(1);
    const service = RedisPersistenceService.getInstance();

    await expect(service.getTimeRemaining('k')).resolves.toBe(42);
    await expect(service.expire('k', 3)).resolves.toBe(1);
    await expect(service.subscribe('updates')).resolves.toBe(1);
    await expect(service.getPattern('store.item')).resolves.toEqual(['store.item.user']);
    await expect(service.removeKey('k')).resolves.toBe(1);

    expect(mockRedisInstance.keys).toHaveBeenCalledWith('*store.item*');
  });
});
