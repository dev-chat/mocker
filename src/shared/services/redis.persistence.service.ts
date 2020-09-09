import ioredis, { Redis } from 'ioredis';

export class RedisPersistenceService {
  public static getInstance(): RedisPersistenceService {
    if (!RedisPersistenceService.instance) {
      RedisPersistenceService.instance = new RedisPersistenceService();
    }
    return RedisPersistenceService.instance;
  }

  private static instance: RedisPersistenceService;
  private static redis: Redis = process.env.PRODUCTION
    ? new ioredis(6379, 'redis').on('connect', () => console.log('Connected to Redis.'))
    : new ioredis().on('connect', () => console.log('Connected to Redis.'));
  private static subscriber: Redis = process.env.PRODUCTION
    ? new ioredis(6379, 'redis').on('connect', () => console.log('Created new subscriber'))
    : new ioredis(6379, 'redis').on('connect', () => console.log('Created new subscriber'));

  getValue(key: string): Promise<string | null> {
    return RedisPersistenceService.redis.get(key);
  }

  setValue(key: string, value: string | number): Promise<string | null> {
    return RedisPersistenceService.redis.set(key, value, 'KEEPTTL');
  }

  setValueWithExpire(key: string, value: string | number, expiryMode: string, time: number): Promise<string | null> {
    return RedisPersistenceService.redis.set(key, value, expiryMode, time);
  }

  getTimeRemaining(key: string): Promise<number> {
    return RedisPersistenceService.redis.ttl(key);
  }

  expire(key: string, seconds: number): Promise<number> {
    return RedisPersistenceService.redis.expire(key, seconds);
  }

  // Left off here.
  subscribe(channel: string): Promise<number> {
    return RedisPersistenceService.subscriber.subscribe(channel);
  }

  getPattern(pattern: string): Promise<string[]> {
    return RedisPersistenceService.redis.keys(`*${pattern}*`);
  }

  removeKey(key: string) {
    return RedisPersistenceService.redis.del(key);
  }
}
