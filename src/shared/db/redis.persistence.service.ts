import ioredis, { Redis } from 'ioredis';

export class RedisPersistenceService {
  public static getInstance(): RedisPersistenceService {
    if (!RedisPersistenceService.instance) {
      RedisPersistenceService.instance = new RedisPersistenceService();
    }
    return RedisPersistenceService.instance;
  }

  private static instance: RedisPersistenceService;
  private static redis: Redis = new ioredis().on('connect', () => console.log('Connected to Redis.'));

  getValue(key: string) {
    return RedisPersistenceService.redis.get(key);
  }

  setValue(key: string, value: string, expiryMode?: string, time?: string | number, setMode?: string | number) {
    return RedisPersistenceService.redis.set(key, value, expiryMode, time, setMode);
  }

  getTimeRemaining(key: string) {
    return RedisPersistenceService.redis.ttl(key);
  }

  expire(key: string, seconds: number) {
    return RedisPersistenceService.redis.expire(key, seconds);
  }
}
