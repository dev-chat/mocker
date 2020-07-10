import ioredis, { Redis } from 'ioredis';

export class RedisPersistenceService {
  public static getInstance(): RedisPersistenceService {
    if (!RedisPersistenceService.instance) {
      RedisPersistenceService.instance = new RedisPersistenceService();
    }
    return RedisPersistenceService.instance;
  }

  private static instance: RedisPersistenceService;
  private static redis: Redis = new ioredis();

  getValue(key: string) {
    return RedisPersistenceService.redis.get(key);
  }

  setValue(key: string, value: string, expiryMode?: string, time?: string | number, setMode?: string | number) {
    return RedisPersistenceService.redis.set(key, value, expiryMode, time, setMode);
  }
}
