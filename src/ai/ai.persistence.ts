import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import { SINGLE_DAY_MS } from '../counter/constants';

enum AITypeEnum {
  Inflight = 'inflight',
  Daily = 'daily',
  DailySummary = 'daily-summary',
  Participated = 'participated',
}

const FIVE_MINUTES_MS = 300000;
const FIVE_SECONDS_MS = 5000;

export class AIPersistenceService {
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

  public setParticipationInFlight(channelId: string, teamId: string): Promise<unknown | null> {
    return this.redis.setValueWithExpire(
      this.getRedisKeyName(channelId, teamId, AITypeEnum.Inflight),
      1,
      'PX',
      FIVE_SECONDS_MS,
    );
  }

  public removeParticipationInFlight(channelId: string, teamId: string): Promise<number> {
    return this.redis.removeKey(this.getRedisKeyName(channelId, teamId, AITypeEnum.Inflight));
  }

  public setHasParticipated(channelId: string, teamId: string): Promise<unknown | null> {
    return this.redis.setValueWithExpire(
      this.getRedisKeyName(channelId, teamId, AITypeEnum.Participated),
      1,
      'PX',
      FIVE_MINUTES_MS,
    );
  }

  public getHasParticipated(channelId: string, teamId: string): Promise<string | null> {
    return this.redis.getValue(this.getRedisKeyName(channelId, teamId, AITypeEnum.Participated));
  }

  private getRedisKeyName(userOrChannelId: string, teamId: string, type: AITypeEnum): string {
    return `ai.${type}.${userOrChannelId}-${teamId}`;
  }
}
