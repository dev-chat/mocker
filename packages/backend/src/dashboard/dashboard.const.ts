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

export const CACHE_TTL_SECONDS: Record<TimePeriod, number> = {
  daily: 5 * 60,
  weekly: 15 * 60,
  monthly: 30 * 60,
  yearly: 60 * 60,
  allTime: 2 * 60 * 60,
};
