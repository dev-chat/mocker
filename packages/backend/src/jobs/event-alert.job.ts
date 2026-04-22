import { CalendarPersistenceService } from '../calendar/calendar.persistence.service';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import { WebService } from '../shared/services/web/web.service';

const ALERT_CHANNEL = '#events';
const ALERT_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const ALERT_DEDUPE_TTL_MS = 26 * 60 * 60 * 1000;

const formatDateLabel = (value: Date, timeZone?: 'UTC'): string =>
  value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });

const formatTimeLabel = (value: Date, includeTimeZoneName = false): string =>
  value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(includeTimeZoneName ? { timeZoneName: 'short' } : {}),
  });

const subtractOneDayUtc = (value: Date): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() - 1);
  return next;
};

const formatOccurrenceWindow = (startsAt: string, endsAt: string, isAllDay: boolean): string => {
  if (isAllDay) {
    const start = new Date(startsAt);
    const inclusiveEnd = subtractOneDayUtc(new Date(endsAt));
    const startLabel = formatDateLabel(start, 'UTC');
    const endLabel = formatDateLabel(inclusiveEnd, 'UTC');
    return startLabel === endLabel ? `${startLabel} (all day)` : `${startLabel} - ${endLabel} (all day)`;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startDateLabel = formatDateLabel(start);
  const endDateLabel = formatDateLabel(end);

  if (startDateLabel === endDateLabel) {
    return `${startDateLabel}, ${formatTimeLabel(start)} - ${formatTimeLabel(end, true)}`;
  }

  return `${startDateLabel}, ${formatTimeLabel(start, true)} - ${endDateLabel}, ${formatTimeLabel(end, true)}`;
};

export class EventAlertJob {
  private calendarPersistenceService = new CalendarPersistenceService();
  private webService = new WebService();
  private redisService = RedisPersistenceService.getInstance();
  private jobLogger = logger.child({ module: 'EventAlertJob' });

  async run(now = new Date()): Promise<void> {
    const windowEnd = new Date(now.getTime() + ALERT_LOOKAHEAD_MS);

    try {
      const upcomingOccurrences = await this.calendarPersistenceService.listUpcomingOccurrences(now, windowEnd);
      if (!upcomingOccurrences.length) {
        this.jobLogger.info('No upcoming calendar events found for alert window.', {
          windowStart: now.toISOString(),
          windowEnd: windowEnd.toISOString(),
        });
        return;
      }

      const unsentOccurrences: typeof upcomingOccurrences = [];
      for (const occurrence of upcomingOccurrences) {
        const dedupeKey = `calendar-alert:${occurrence.occurrenceId}`;
        const existing = await this.redisService.getValue(dedupeKey);
        if (!existing) {
          unsentOccurrences.push(occurrence);
        }
      }

      if (!unsentOccurrences.length) {
        this.jobLogger.info('Upcoming events already alerted.', { candidateCount: upcomingOccurrences.length });
        return;
      }

      const lines = unsentOccurrences
        .slice(0, 20)
        .map((occurrence) => {
          const locationSuffix = occurrence.location ? ` @ ${occurrence.location}` : '';
          const occurrenceWindow = formatOccurrenceWindow(occurrence.startsAt, occurrence.endsAt, occurrence.isAllDay);
          return `- ${occurrenceWindow} - ${occurrence.title}${locationSuffix}`;
        })
        .join('\n');

      const overflowCount = unsentOccurrences.length - Math.min(20, unsentOccurrences.length);
      const overflowLine = overflowCount > 0 ? `\n...and ${overflowCount} more event(s).` : '';
      const text = `:calendar: Upcoming events in the next 24 hours:\n${lines}${overflowLine}`;

      await this.webService.sendMessage(ALERT_CHANNEL, text);

      await Promise.all(
        unsentOccurrences.map((occurrence) =>
          this.redisService.setValueWithExpire(
            `calendar-alert:${occurrence.occurrenceId}`,
            now.toISOString(),
            'PX',
            ALERT_DEDUPE_TTL_MS,
          ),
        ),
      );

      this.jobLogger.info('Sent upcoming event alert.', {
        notifiedCount: unsentOccurrences.length,
        windowStart: now.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
    } catch (error: unknown) {
      logError(this.jobLogger, 'Event alert job failed', error, {
        windowStart: now.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
      throw error;
    }
  }
}
