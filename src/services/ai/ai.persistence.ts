import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';
import { SINGLE_DAY_MS } from '../counter/constants';

enum AITypeEnum {
  Inflight = 'inflight',
  Daily = 'daily',
}

export class AIPersistenceService {
  public static getInstance(): AIPersistenceService {
    if (!AIPersistenceService.instance) {
      AIPersistenceService.instance = new AIPersistenceService();
    }
    return AIPersistenceService.instance;
  }

  private static instance: AIPersistenceService;
  private redis: RedisPersistenceService = RedisPersistenceService.getInstance();

  public async removeInflight(userId: string, teamId: string): Promise<number> {
    return this.redis.removeKey(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight));
  }

  public getInflight(userId: string, teamId: string): Promise<string | null> {
    return this.redis.getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight));
  }

  public setInflight(userId: string, teamId: string): Promise<string | null> {
    return this.redis.setValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight), 'yes');
  }

  public async setDailyRequests(userId: string, teamId: string): Promise<string | null> {
    const numberOfRequests: number | undefined = await this.redis
      .getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily))
      .then(x => (x ? Number(x) : undefined));

    if (!numberOfRequests) {
      return this.redis.setValueWithExpire(
        this.getRedisKeyName(userId, teamId, AITypeEnum.Daily),
        1,
        'PX',
        SINGLE_DAY_MS,
      );
    } else {
      return this.redis.setValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily), numberOfRequests + 1);
    }
  }

  public async decrementDailyRequests(userId: string, teamId: string): Promise<string | null> {
    const numberOfRequests: number | undefined = await this.redis
      .getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily))
      .then(x => (x ? Number(x) : undefined));

    if (numberOfRequests) {
      return this.redis.setValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily), numberOfRequests - 1);
    } else {
      return null;
    }
  }

  public async getDailyRequests(userId: string, teamId: string): Promise<string | null> {
    return await this.redis.getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily));
  }

  private getRedisKeyName(userId: string, teamId: string, type: AITypeEnum): string {
    return `ai.${type}.${userId}-${teamId}`;
  }
}
