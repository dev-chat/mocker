import type { CalendarEventInput, RecurrenceFrequency, RecurrenceRule } from './calendar.model';

const isRecurrenceFrequency = (value: unknown): value is RecurrenceFrequency =>
  value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';

export const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOnly = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const addDaysUtc = (source: Date, days: number): Date => {
  const next = new Date(source);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const parseRecurringRule = (value: unknown, startsAt: Date): RecurrenceRule | null | 'invalid' => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return 'invalid';
  }

  const frequency = Reflect.get(value, 'frequency');
  if (!isRecurrenceFrequency(frequency)) {
    return 'invalid';
  }

  const intervalValue = Reflect.get(value, 'interval');
  const interval = typeof intervalValue === 'number' ? Math.trunc(intervalValue) : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    return 'invalid';
  }

  const untilValue = Reflect.get(value, 'until');
  let until: string | undefined;
  if (untilValue !== undefined && untilValue !== null) {
    if (typeof untilValue !== 'string') {
      return 'invalid';
    }

    const untilDate = parseDate(untilValue);
    if (!untilDate || untilDate < startsAt) {
      return 'invalid';
    }

    until = untilDate.toISOString();
  }

  return {
    frequency,
    interval,
    until,
  };
};

export const parseBody = (payload: unknown): CalendarEventInput | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const titleRaw = Reflect.get(payload, 'title');
  const isAllDayRaw = Reflect.get(payload, 'isAllDay');
  const startsAtRaw = Reflect.get(payload, 'startsAt');
  const endsAtRaw = Reflect.get(payload, 'endsAt');
  const allDayStartDateRaw = Reflect.get(payload, 'allDayStartDate');
  const allDayEndDateRaw = Reflect.get(payload, 'allDayEndDate');
  const locationRaw = Reflect.get(payload, 'location');

  if (typeof titleRaw !== 'string') {
    return null;
  }

  const title = titleRaw.trim();
  if (!title) {
    return null;
  }

  const isAllDay = isAllDayRaw === true;

  let startsAt: Date;
  let endsAt: Date;

  if (isAllDay) {
    const allDayStartDate = parseDateOnly(allDayStartDateRaw);
    const allDayEndDate = parseDateOnly(allDayEndDateRaw);
    if (!allDayStartDate || !allDayEndDate || allDayEndDate < allDayStartDate) {
      return null;
    }

    startsAt = allDayStartDate;
    endsAt = addDaysUtc(allDayEndDate, 1);
  } else {
    const hasStartsAt = startsAtRaw !== undefined && startsAtRaw !== null;
    const hasEndsAt = endsAtRaw !== undefined && endsAtRaw !== null;
    if (!hasStartsAt || !hasEndsAt) {
      return null;
    }

    const parsedStartsAt = parseDate(startsAtRaw);
    const parsedEndsAt = parseDate(endsAtRaw);
    if (!parsedStartsAt || !parsedEndsAt || parsedStartsAt >= parsedEndsAt) {
      return null;
    }

    startsAt = parsedStartsAt;
    endsAt = parsedEndsAt;
  }

  const location = typeof locationRaw === 'string' && locationRaw.trim() ? locationRaw.trim() : null;

  const recurrence = parseRecurringRule(Reflect.get(payload, 'recurrence'), startsAt);
  if (recurrence === 'invalid') {
    return null;
  }

  return {
    title,
    location,
    isAllDay,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    recurrence,
  };
};

export const parseRange = (startRaw: unknown, endRaw: unknown): { start: Date; end: Date } | null => {
  const parsedStart = parseDate(startRaw);
  const parsedEnd = parseDate(endRaw);

  if (!parsedStart || !parsedEnd || parsedStart >= parsedEnd) {
    return null;
  }

  return { start: parsedStart, end: parsedEnd };
};
