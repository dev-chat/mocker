import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';
import { SINGLE_DAY_MS } from '../counter/constants';
import { AITypeEnum } from './ai.enum';

export class AIPersistenceService {
  redis: RedisPersistenceService = RedisPersistenceService.getInstance();

  public async removeInflight(userId: string, teamId: string): Promise<number> {
    return this.redis.removeKey(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight));
  }

  public getInflight(userId: string, teamId: string): Promise<string | null> {
    return this.redis.getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight));
  }

  public setInflight(userId: string, teamId: string): Promise<string | null> {
    return this.redis.setValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Inflight), 'yes');
  }

  public setHasUsedSummary(userId: string, teamId: string): Promise<unknown | null> {
    const endOfDay = new Date().setHours(23, 59, 59, 999);
    const timeUntilEndOfDay = endOfDay - new Date().getTime();
    return this.redis.setValueWithExpire(
      this.getRedisKeyName(userId, teamId, AITypeEnum.DailySummary),
      'yes',
      'PX',
      timeUntilEndOfDay,
    );
  }

  public removeHasUsedSummary(userId: string, teamId: string): Promise<unknown | null> {
    return this.redis.removeKey(this.getRedisKeyName(userId, teamId, AITypeEnum.DailySummary));
  }

  public async setDailyRequests(userId: string, teamId: string): Promise<unknown | null> {
    const numberOfRequests: number | undefined = await this.redis
      .getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily))
      .then((x) => (x ? Number(x) : undefined));

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
      .then((x) => (x ? Number(x) : undefined));

    if (numberOfRequests) {
      return this.redis.setValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily), numberOfRequests - 1);
    } else {
      return null;
    }
  }

  public getDailyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.Daily));
  }

  public getHasUsedSummary(userId: string, teamId: string): Promise<string | null> {
    return this.redis.getValue(this.getRedisKeyName(userId, teamId, AITypeEnum.DailySummary));
  }

  private getRedisKeyName(userId: string, teamId: string, type: AITypeEnum): string {
    return `ai.${type}.${userId}-${teamId}`;
  }
}
