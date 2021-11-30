import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';

export class ConfessionPersistenceService {
  public static getInstance(): ConfessionPersistenceService {
    if (!ConfessionPersistenceService.instance) {
      ConfessionPersistenceService.instance = new ConfessionPersistenceService();
    }
    return ConfessionPersistenceService.instance;
  }

  private static instance: ConfessionPersistenceService;
  private redis: RedisPersistenceService = RedisPersistenceService.getInstance();
  private confessionExpiryMs = 28800000;

  async logConfession(requestorId: string, teamId: string): Promise<number> {
    const key = this.getRedisKeyName(requestorId, teamId);
    const redisValue = await this.redis.getValue(key);
    const confessionCount = redisValue ? parseInt(redisValue) : 0;
    if (confessionCount > 0) {
      await this.redis.setValue(key, confessionCount + 1);
    } else {
      const expireTime = this.confessionExpiryMs / 1000;
      await this.redis.setValueWithExpire(key, 1, 'EX', expireTime);
    }
    return confessionCount + 1;
  }

  private getRedisKeyName(userId: string, teamId: string): string {
    return `confessions.${userId}-${teamId}`;
  }
}
