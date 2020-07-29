import { UpdateResult, getRepository } from 'typeorm';
import { Muzzle } from '../../shared/db/models/Muzzle';
import { ABUSE_PENALTY_TIME, MAX_MUZZLES, MAX_TIME_BETWEEN_MUZZLES } from './constants';
import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';

export class MuzzlePersistenceService {
  public static getInstance(): MuzzlePersistenceService {
    if (!MuzzlePersistenceService.instance) {
      MuzzlePersistenceService.instance = new MuzzlePersistenceService();
    }
    return MuzzlePersistenceService.instance;
  }

  private static instance: MuzzlePersistenceService;
  private redis: RedisPersistenceService = RedisPersistenceService.getInstance();

  public addMuzzle(requestorId: string, muzzledId: string, teamId: string, time: number): Promise<Muzzle> {
    return new Promise(async (resolve, reject) => {
      const muzzle = new Muzzle();
      muzzle.requestorId = requestorId;
      muzzle.muzzledId = muzzledId;
      muzzle.teamId = teamId;
      muzzle.messagesSuppressed = 0;
      muzzle.wordsSuppressed = 0;
      muzzle.charactersSuppressed = 0;
      muzzle.milliseconds = time;
      await getRepository(Muzzle)
        .save(muzzle)
        .then(muzzleFromDb => {
          const expireTime = Math.floor(time / 1000);
          this.redis.setValueWithExpire(
            `muzzle.muzzled.${muzzledId}-${teamId}`,
            muzzleFromDb.id.toString(),
            'EX',
            expireTime,
          );
          this.redis.setValueWithExpire(`muzzle.muzzled.${muzzledId}-${teamId}.suppressions`, '0', 'EX', expireTime);
          this.redis.setValueWithExpire(
            `muzzle.muzzled.${muzzledId}-${teamId}.requestor`,
            requestorId,
            'EX',
            expireTime,
          );
          this.setRequestorCount(requestorId, teamId);
          resolve();
        })
        .catch(e => reject(e));
    });
  }

  public removeMuzzlePrivileges(requestorId: string, teamId: string): void {
    this.redis.setValueWithExpire(`muzzle.requestor.${requestorId}-${teamId}`, '2', 'EX', MAX_TIME_BETWEEN_MUZZLES);
  }

  public async setRequestorCount(requestorId: string, teamId: string): Promise<void> {
    const numberOfRequests: string | null = await this.redis.getValue(`muzzle.requestor.${requestorId}-${teamId}`);
    const requests: number = numberOfRequests ? +numberOfRequests : 0;
    const newNumber = requests + 1;
    if (!numberOfRequests) {
      this.redis.setValueWithExpire(
        `muzzle.requestor.${requestorId}-${teamId}`,
        newNumber.toString(),
        'EX',
        MAX_TIME_BETWEEN_MUZZLES,
      );
    } else if (requests < MAX_MUZZLES) {
      this.redis.setValue(`muzzle.requestor.${requestorId}-${teamId}`, newNumber);
    }
  }

  /**
   * Returns boolean whether max muzzles have been reached.
   */
  public async isMaxMuzzlesReached(userId: string, teamId: string): Promise<boolean> {
    const muzzles: string | null = await this.redis.getValue(`muzzle.requestor.${userId}-${teamId}`);
    return !!(muzzles && +muzzles === MAX_MUZZLES);
  }

  /**
   * Adds the specified amount of time to a specified muzzled user.
   */
  public async addMuzzleTime(userId: string, teamId: string, timeToAdd: number): Promise<void> {
    const muzzledId: string | null = await this.redis.getValue(`muzzle.muzzled.${userId}-${teamId}`);
    if (muzzledId) {
      const remainingTime: number = await this.redis.getTimeRemaining(`muzzle.muzzled.${userId}-${teamId}`);
      const newTime = Math.floor(remainingTime + timeToAdd / 1000);
      this.incrementMuzzleTime(+muzzledId, ABUSE_PENALTY_TIME);
      console.log(`Setting ${userId}'s muzzle time to ${newTime}`);
      this.redis.expire(`muzzle.muzzled.${userId}-${teamId}`, newTime);
    }
  }

  public async getMuzzle(userId: string, teamId: string): Promise<string | null> {
    return await this.redis.getValue(`muzzle.muzzled.${userId}-${teamId}`);
  }

  public async getSuppressions(userId: string, teamId: string): Promise<string | null> {
    return await this.redis.getValue(`muzzle.muzzled.${userId}-${teamId}.suppressions`);
  }

  public async incrementStatefulSuppressions(userId: string, teamId: string): Promise<void> {
    const suppressions = await this.redis.getValue(`muzzle.muzzled.${userId}-${teamId}.suppressions`);
    if (suppressions) {
      const newValue = +suppressions + 1;
      await this.redis.setValue(`muzzle.muzzled.${userId}-${teamId}.suppressions`, newValue.toString());
    } else {
      await this.redis.setValue(`muzzle.muzzled.${userId}-${teamId}.suppressions`, '1');
    }
  }

  /**
   * Returns boolean whether user is muzzled or not.
   */
  public async isUserMuzzled(userId: string, teamId: string): Promise<boolean> {
    return !!(await this.redis.getValue(`muzzle.muzzled.${userId}-${teamId}`));
  }

  public incrementMuzzleTime(id: number, ms: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'milliseconds', ms);
  }

  public incrementMessageSuppressions(id: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'messagesSuppressed', 1);
  }

  public incrementWordSuppressions(id: number, suppressions: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'wordsSuppressed', suppressions);
  }

  public incrementCharacterSuppressions(id: number, charactersSuppressed: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'charactersSuppressed', charactersSuppressed);
  }
  /**
   * Determines suppression counts for messages that are ONLY deleted and not muzzled.
   * Used when a muzzled user has hit their max suppressions or when they have tagged channel.
   */
  public trackDeletedMessage(muzzleId: number, text: string): void {
    const words = text.split(' ').length;
    const characters = text.split('').length;
    this.incrementMessageSuppressions(muzzleId);
    this.incrementWordSuppressions(muzzleId, words);
    this.incrementCharacterSuppressions(muzzleId, characters);
  }
}
