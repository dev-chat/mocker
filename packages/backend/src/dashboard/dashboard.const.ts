import type { TimePeriod } from './dashboard.model';

export const TOP_CHANNELS_LIMIT = 5;
export const LEADERBOARD_LIMIT = 10;

export const VALID_PERIODS: readonly TimePeriod[] = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];
export const DEFAULT_PERIOD: TimePeriod = 'weekly';

export const PERIOD_DAYS: Record<TimePeriod, number | null> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
  allTime: null,
};

export const CACHE_TTL_MS: Record<TimePeriod, number> = {
  daily: 300_000,
  weekly: 900_000,
  monthly: 1_800_000,
  yearly: 3_600_000,
  allTime: 7_200_000,
};
