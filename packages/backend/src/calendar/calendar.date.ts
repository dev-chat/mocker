import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const UTC_TIME_ZONE = 'UTC';

export const parseIsoDate = (value: string): Date | null => {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

export const parseUtcDateOnly = (value: string): Date | null => {
  const parsed = fromZonedTime(`${value}T00:00:00`, UTC_TIME_ZONE);
  if (!isValid(parsed)) {
    return null;
  }

  return formatInTimeZone(parsed, UTC_TIME_ZONE, 'yyyy-MM-dd') === value ? parsed : null;
};

export const toUtcWallClock = (value: Date): Date => toZonedTime(value, UTC_TIME_ZONE);
export const fromUtcWallClock = (value: Date): Date => fromZonedTime(value, UTC_TIME_ZONE);

export const addUtcDays = (value: Date, days: number): Date => new Date(value.getTime() + days * DAY_IN_MS);
