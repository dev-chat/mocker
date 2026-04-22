import { getRepository } from 'typeorm';
import { CalendarEvent } from '../shared/db/models/CalendarEvent';
import { SlackUser } from '../shared/db/models/SlackUser';
import type {
  CalendarEventInput,
  CalendarEventOccurrence,
  CalendarEventSeries,
  RecurrenceFrequency,
  RecurrenceRule,
} from './calendar.model';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toIso = (value: Date): string => value.toISOString();
const toIsoNullable = (value: Date | null): string | null => (value ? value.toISOString() : null);

const isRecurrenceFrequency = (value: unknown): value is RecurrenceFrequency =>
  value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';

const parseRecurrenceRuleFromUnknown = (value: unknown): RecurrenceRule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const frequency = Reflect.get(value, 'frequency');
  const interval = Reflect.get(value, 'interval');
  const until = Reflect.get(value, 'until');

  if (!isRecurrenceFrequency(frequency)) {
    return null;
  }

  if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 1 || interval > 365) {
    return null;
  }

  if (until !== undefined && until !== null && typeof until !== 'string') {
    return null;
  }

  return {
    frequency,
    interval,
    until: typeof until === 'string' ? until : undefined,
  };
};

const parseRecurrenceRule = (value: string | null): RecurrenceRule | null => {
  if (!value) {
    return null;
  }

  try {
    return parseRecurrenceRuleFromUnknown(JSON.parse(value));
  } catch {
    return null;
  }
};

const addByFrequency = (source: Date, frequency: RecurrenceFrequency, interval: number): Date => {
  const next = new Date(source);
  switch (frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + interval * 7);
      return next;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + interval);
      return next;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + interval);
      return next;
  }
};

const intersectsRange = (start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean =>
  start < rangeEnd && end > rangeStart;

const getMonthDifference = (start: Date, end: Date): number =>
  (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());

const advanceBySteps = (source: Date, frequency: RecurrenceFrequency, interval: number, steps: number): Date => {
  if (steps <= 0) {
    return new Date(source);
  }

  switch (frequency) {
    case 'daily':
      return new Date(source.getTime() + steps * interval * DAY_IN_MS);
    case 'weekly':
      return new Date(source.getTime() + steps * interval * 7 * DAY_IN_MS);
    case 'monthly':
    case 'yearly': {
      let next = new Date(source);
      let remainingSteps = steps;
      while (remainingSteps > 0) {
        next = addByFrequency(next, frequency, interval);
        remainingSteps -= 1;
      }
      return next;
    }
  }
};

const getStepEstimate = (
  start: Date,
  rangeStart: Date,
  durationMs: number,
  frequency: RecurrenceFrequency,
  interval: number,
): number => {
  const relevantStart = new Date(rangeStart.getTime() - Math.max(durationMs, 0));

  switch (frequency) {
    case 'daily': {
      const diffMs = relevantStart.getTime() - start.getTime();
      return diffMs > 0 ? Math.floor(diffMs / (interval * DAY_IN_MS)) : 0;
    }
    case 'weekly': {
      const diffMs = relevantStart.getTime() - start.getTime();
      return diffMs > 0 ? Math.floor(diffMs / (interval * 7 * DAY_IN_MS)) : 0;
    }
    case 'monthly': {
      const diffMonths = getMonthDifference(start, relevantStart);
      return diffMonths > 0 ? Math.max(0, Math.floor(diffMonths / interval) - 1) : 0;
    }
    case 'yearly': {
      const diffYears = relevantStart.getUTCFullYear() - start.getUTCFullYear();
      return diffYears > 0 ? Math.max(0, Math.floor(diffYears / interval) - 1) : 0;
    }
  }
};

const findFirstRelevantOccurrenceStart = (
  start: Date,
  rangeStart: Date,
  rangeEnd: Date,
  durationMs: number,
  frequency: RecurrenceFrequency,
  interval: number,
  until: Date | null,
): Date => {
  const estimatedSteps = getStepEstimate(start, rangeStart, durationMs, frequency, interval);
  let occurrenceStart = advanceBySteps(start, frequency, interval, estimatedSteps);

  for (;;) {
    const nextOccurrenceStart = addByFrequency(occurrenceStart, frequency, interval);
    if (nextOccurrenceStart.getTime() <= occurrenceStart.getTime()) {
      return occurrenceStart;
    }

    if (until && nextOccurrenceStart > until) {
      return occurrenceStart;
    }

    if (nextOccurrenceStart >= rangeEnd) {
      return occurrenceStart;
    }

    const nextOccurrenceEnd = new Date(nextOccurrenceStart.getTime() + durationMs);
    if (!intersectsRange(nextOccurrenceStart, nextOccurrenceEnd, rangeStart, rangeEnd)) {
      occurrenceStart = nextOccurrenceStart;
      continue;
    }

    return occurrenceStart;
  }
};

export class CalendarPersistenceService {
  private logger = logger.child({ module: 'CalendarPersistenceService' });

  private mapSeries(entity: CalendarEvent): CalendarEventSeries {
    return {
      id: entity.id,
      teamId: entity.createdByUser.teamId,
      createdByUserId: entity.createdByUser.slackId,
      title: entity.title,
      location: entity.location,
      isAllDay: entity.isAllDay,
      startsAt: toIsoNullable(entity.startsAt),
      endsAt: toIsoNullable(entity.endsAt),
      recurrence: parseRecurrenceRule(entity.recurrenceRule),
      createdAt: toIso(entity.createdAt),
      updatedAt: toIso(entity.updatedAt),
    };
  }

  private expandSeriesOccurrences(
    series: CalendarEventSeries,
    rangeStart: Date,
    rangeEnd: Date,
  ): CalendarEventOccurrence[] {
    // Legacy safety: if old rows exist without start/end, fall back to a one-day window.
    const start = series.startsAt ? new Date(series.startsAt) : new Date(series.createdAt);
    const end = series.endsAt ? new Date(series.endsAt) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const durationMs = end.getTime() - start.getTime();
    const recurrence = series.recurrence;

    if (!recurrence) {
      if (!intersectsRange(start, end, rangeStart, rangeEnd)) {
        return [];
      }

      return [
        {
          occurrenceId: `${series.id}:${start.toISOString()}`,
          seriesId: series.id,
          title: series.title,
          location: series.location,
          startsAt: toIso(start),
          endsAt: toIso(end),
          isAllDay: series.isAllDay,
          isRecurring: false,
        },
      ];
    }

    const interval = recurrence.interval;
    const until = recurrence.until ? new Date(recurrence.until) : null;

    const items: CalendarEventOccurrence[] = [];
    let occurrenceStart = findFirstRelevantOccurrenceStart(
      start,
      rangeStart,
      rangeEnd,
      durationMs,
      recurrence.frequency,
      interval,
      until,
    );

    for (;;) {
      if (until && occurrenceStart > until) {
        break;
      }

      if (occurrenceStart >= rangeEnd) {
        break;
      }

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (intersectsRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
        items.push({
          occurrenceId: `${series.id}:${occurrenceStart.toISOString()}`,
          seriesId: series.id,
          title: series.title,
          location: series.location,
          startsAt: toIso(occurrenceStart),
          endsAt: toIso(occurrenceEnd),
          isAllDay: series.isAllDay,
          isRecurring: true,
        });
      }

      const nextOccurrenceStart = addByFrequency(occurrenceStart, recurrence.frequency, interval);
      if (nextOccurrenceStart.getTime() <= occurrenceStart.getTime()) {
        break;
      }

      occurrenceStart = nextOccurrenceStart;
    }

    return items;
  }

  async listSeries(teamId: string): Promise<CalendarEventSeries[]> {
    try {
      const events = await getRepository(CalendarEvent).find({
        where: { createdByUser: { teamId } },
        relations: ['createdByUser'],
        order: { startsAt: 'ASC' },
      });
      return events.map((item) => this.mapSeries(item));
    } catch (error: unknown) {
      logError(this.logger, 'Failed to list calendar series', error, { teamId });
      throw error;
    }
  }

  async listOccurrences(teamId: string, rangeStart: Date, rangeEnd: Date): Promise<CalendarEventOccurrence[]> {
    const series = await this.listSeries(teamId);
    return series
      .flatMap((item) => this.expandSeriesOccurrences(item, rangeStart, rangeEnd))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async createSeries(teamId: string, userId: string, input: CalendarEventInput): Promise<CalendarEventSeries> {
    try {
      const user = await getRepository(SlackUser).findOne({
        where: { slackId: userId, teamId },
      });

      if (!user) {
        throw new Error(`Unable to find SlackUser for teamId=${teamId} and userId=${userId}`);
      }

      const repo = getRepository(CalendarEvent);
      const entity = repo.create({
        createdByUser: user,
        title: input.title,
        location: input.location,
        isAllDay: input.isAllDay,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        recurrenceRule: input.recurrence ? JSON.stringify(input.recurrence) : null,
      });

      const saved = await repo.save(entity);
      return this.mapSeries(saved);
    } catch (error: unknown) {
      logError(this.logger, 'Failed to create calendar series', error, { teamId, userId });
      throw error;
    }
  }

  async updateSeries(teamId: string, id: string, input: CalendarEventInput): Promise<CalendarEventSeries | null> {
    try {
      const repo = getRepository(CalendarEvent);
      const existing = await repo.findOne({
        where: { id, createdByUser: { teamId } },
        relations: ['createdByUser'],
      });
      if (!existing) {
        return null;
      }

      existing.title = input.title;
      existing.location = input.location;
      existing.isAllDay = input.isAllDay;
      existing.startsAt = input.startsAt ? new Date(input.startsAt) : null;
      existing.endsAt = input.endsAt ? new Date(input.endsAt) : null;
      existing.recurrenceRule = input.recurrence ? JSON.stringify(input.recurrence) : null;

      const saved = await repo.save(existing);
      return this.mapSeries(saved);
    } catch (error: unknown) {
      logError(this.logger, 'Failed to update calendar series', error, { teamId, id });
      throw error;
    }
  }

  async deleteSeries(teamId: string, id: string): Promise<boolean> {
    try {
      const repo = getRepository(CalendarEvent);
      const existing = await repo.findOne({
        where: { id, createdByUser: { teamId } },
        relations: ['createdByUser'],
      });
      if (!existing) {
        return false;
      }

      await repo.remove(existing);
      return true;
    } catch (error: unknown) {
      logError(this.logger, 'Failed to delete calendar series', error, { teamId, id });
      throw error;
    }
  }

  async listSeriesAndOccurrences(
    teamId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<{ series: CalendarEventSeries[]; occurrences: CalendarEventOccurrence[] }> {
    const series = await this.listSeries(teamId);
    const occurrences = series
      .flatMap((item) => this.expandSeriesOccurrences(item, rangeStart, rangeEnd))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { series, occurrences };
  }

  async listUpcomingOccurrences(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<{ teamId: string; occurrences: CalendarEventOccurrence[] }[]> {
    try {
      const events = await getRepository(CalendarEvent).find({
        relations: ['createdByUser'],
        order: { startsAt: 'ASC' },
      });

      const seriesByTeam = new Map<string, CalendarEventSeries[]>();
      for (const event of events) {
        const s = this.mapSeries(event);
        const teamSeries = seriesByTeam.get(s.teamId) ?? [];
        teamSeries.push(s);
        seriesByTeam.set(s.teamId, teamSeries);
      }

      return Array.from(seriesByTeam.entries()).map(([teamId, teamSeriesList]) => ({
        teamId,
        occurrences: teamSeriesList
          .flatMap((item) => this.expandSeriesOccurrences(item, rangeStart, rangeEnd))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      }));
    } catch (error: unknown) {
      logError(this.logger, 'Failed to list upcoming calendar occurrences', error, {
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });
      throw error;
    }
  }
}
