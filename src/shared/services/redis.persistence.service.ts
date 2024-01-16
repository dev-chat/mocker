import { Redis } from 'ioredis';

export class RedisPersistenceService {
  public static getInstance(): RedisPersistenceService {
    if (!RedisPersistenceService.instance) {
      RedisPersistenceService.instance = new RedisPersistenceService();
    }
    return RedisPersistenceService.instance;
  }

  constructor() {
    RedisPersistenceService.redis.on('connect', () => console.log('Successfully connected to Redis'));
  }

  private static instance: RedisPersistenceService;
  private static redis: Redis = new Redis();

  getValue(key: string): Promise<string | null> {
    return RedisPersistenceService.redis.get(key);
  }

  setValue(key: string, value: string | number): Promise<string | null> {
    return RedisPersistenceService.redis.set(key, value, 'KEEPTTL');
  }

  setValueWithExpire(key: string, value: string | number, expiryMode: string, time: number): Promise<unknown | null> {
    if (expiryMode === 'EX') {
      return RedisPersistenceService.redis.setex(key, time, value);
    } else if (expiryMode === 'PX') {
      return RedisPersistenceService.redis.psetex(key, time, value);
    }
    throw Error(`Unknown expiryMode: ${expiryMode}. Please use EX or PX.`);
  }

  getTimeRemaining(key: string): Promise<number> {
    return RedisPersistenceService.redis.ttl(key);
  }

  expire(key: string, seconds: number): Promise<number> {
    return RedisPersistenceService.redis.expire(key, seconds);
  }

  // Left off here.
  subscribe(channel: string): Promise<unknown> {
    return RedisPersistenceService.redis.subscribe(channel);
  }

  getPattern(pattern: string): Promise<string[]> {
    return RedisPersistenceService.redis.keys(`*${pattern}*`);
  }

  removeKey(key: string) {
    return RedisPersistenceService.redis.del(key);
  }
}
