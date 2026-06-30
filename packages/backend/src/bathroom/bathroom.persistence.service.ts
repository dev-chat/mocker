import { getRepository } from 'typeorm';
import { BathroomTimer } from '../shared/db/models/BathroomTimer';
import { BathroomUser } from '../shared/db/models/BathroomUser';

export interface BathroomUserProfile {
  slackId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BathroomLeaderboardEntry {
  slackId: string;
  displayName: string;
  totalSeconds: number;
}

export class ActiveTimerExistsError extends Error {
  public constructor() {
    super('Active timer already exists');
  }
}

export class ActiveTimerNotFoundError extends Error {
  public constructor() {
    super('Active timer not found');
  }
}

export class BathroomUserNotFoundError extends Error {
  public constructor() {
    super('Bathroom user not found');
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function overlapSeconds(startAt: Date, endAt: Date, rangeStart: Date, rangeEnd: Date): number {
  const overlapStart = Math.max(startAt.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(endAt.getTime(), rangeEnd.getTime());
  if (overlapEnd <= overlapStart) {
    return 0;
  }
  return Math.round((overlapEnd - overlapStart) / 1000);
}

export class BathroomPersistenceService {
  public async upsertUser(profile: BathroomUserProfile): Promise<BathroomUser> {
    const userRepo = getRepository(BathroomUser);
    const existing = await userRepo.findOne({ where: { slackId: profile.slackId } });

    if (existing) {
      existing.displayName = profile.displayName;
      existing.avatarUrl = profile.avatarUrl;
      return userRepo.save(existing);
    }

    return userRepo.save(
      Object.assign(new BathroomUser(), {
        slackId: profile.slackId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      }),
    );
  }

  public async getUserBySlackId(slackId: string): Promise<BathroomUser | null> {
    return getRepository(BathroomUser).findOne({ where: { slackId } });
  }

  public async getActiveTimerForSlackUser(slackId: string): Promise<BathroomTimer | null> {
    return getRepository(BathroomTimer)
      .createQueryBuilder('timer')
      .innerJoinAndSelect('timer.user', 'user')
      .where('user.slack_id = :slackId', { slackId })
      .andWhere('timer.end_at IS NULL')
      .orderBy('timer.start_at', 'DESC')
      .getOne();
  }

  public async startTimer(slackId: string): Promise<BathroomTimer> {
    const user = await this.getUserBySlackId(slackId);
    if (!user) {
      throw new BathroomUserNotFoundError();
    }

    const timerRepo = getRepository(BathroomTimer);
    const existing = await timerRepo
      .createQueryBuilder('timer')
      .innerJoin('timer.user', 'user')
      .where('user.slack_id = :slackId', { slackId })
      .andWhere('timer.end_at IS NULL')
      .getOne();

    if (existing) {
      throw new ActiveTimerExistsError();
    }

    return timerRepo.save(
      Object.assign(new BathroomTimer(), {
        user,
        startAt: new Date(),
        endAt: null,
        durationSeconds: null,
      }),
    );
  }

  public async stopTimer(slackId: string): Promise<BathroomTimer> {
    const timerRepo = getRepository(BathroomTimer);
    const activeTimer = await timerRepo
      .createQueryBuilder('timer')
      .innerJoinAndSelect('timer.user', 'user')
      .where('user.slack_id = :slackId', { slackId })
      .andWhere('timer.end_at IS NULL')
      .orderBy('timer.start_at', 'DESC')
      .getOne();

    if (!activeTimer) {
      throw new ActiveTimerNotFoundError();
    }

    const endAt = new Date();
    activeTimer.endAt = endAt;
    activeTimer.durationSeconds = Math.round((endAt.getTime() - activeTimer.startAt.getTime()) / 1000);

    return timerRepo.save(activeTimer);
  }

  public async getLeaderboardForDate(date: Date): Promise<BathroomLeaderboardEntry[]> {
    const rangeStart = startOfUtcDay(date);
    const rangeEnd = endOfUtcDay(date);

    const timers = await getRepository(BathroomTimer)
      .createQueryBuilder('timer')
      .innerJoinAndSelect('timer.user', 'user')
      .where('timer.start_at < :rangeEnd', { rangeEnd })
      .andWhere('timer.end_at IS NOT NULL')
      .andWhere('timer.end_at > :rangeStart', { rangeStart })
      .orderBy('timer.start_at', 'ASC')
      .getMany();

    const totals = new Map<string, BathroomLeaderboardEntry>();
    for (const timer of timers) {
      if (!timer.endAt) {
        continue;
      }

      const totalSeconds = overlapSeconds(timer.startAt, timer.endAt, rangeStart, rangeEnd);
      if (totalSeconds <= 0) {
        continue;
      }

      const current = totals.get(timer.user.slackId) ?? {
        slackId: timer.user.slackId,
        displayName: timer.user.displayName,
        totalSeconds: 0,
      };
      current.totalSeconds += totalSeconds;
      totals.set(current.slackId, current);
    }

    return Array.from(totals.values()).sort(
      (left, right) => left.totalSeconds - right.totalSeconds || left.displayName.localeCompare(right.displayName),
    );
  }
}
