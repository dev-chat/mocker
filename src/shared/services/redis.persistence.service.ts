import { Redis } from 'ioredis';
import { logger } from '../logger/logger';

export class RedisPersistenceService {
  logger = logger.child({ module: 'RedisPersistenceService' });
  constructor() {
    RedisPersistenceService.redis.on('connect', () => this.logger.info('Successfully connected to Redis'));
  }
  private static redis: Redis = !!process.env.REDIS_CONTAINER_NAME
    ? new Redis(process.env.REDIS_CONTAINER_NAME as string)
    : new Redis({ host: 'host.docker.internal' });

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
