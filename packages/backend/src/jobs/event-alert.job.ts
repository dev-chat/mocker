import { CalendarPersistenceService } from '../calendar/calendar.persistence.service';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import { WebService } from '../shared/services/web/web.service';
import type { CalendarEventOccurrence } from '../calendar/calendar.model';

const ALERT_CHANNEL = process.env.EVENTS_ALERT_CHANNEL ?? '#events';
const ALERT_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const ALERT_DEDUPE_TTL_MS = 26 * 60 * 60 * 1000;

/** Format a Date as "Mon Day" (e.g. "Apr 21") in UTC, used for all-day event labels. */
const formatUtcDateLabel = (value: Date): string =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Format a Date as a 12-hour time string in UTC, used as Slack timestamp fallback text. */
const formatUtcTimeLabel = (value: Date): string =>
  value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

const toUnixSeconds = (value: Date): number => Math.floor(value.getTime() / 1000);

/** Wrap a Date in Slack's <!date^…> syntax so each recipient sees it in their own Slack timezone. */
const slackTimestamp = (value: Date, format: string, fallback: string): string =>
  `<!date^${toUnixSeconds(value)}^${format}|${fallback}>`;

const subtractOneDayUtc = (value: Date): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() - 1);
  return next;
};

const startOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addOneDayUtc = (value: Date): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const occursTodayUtc = (occurrence: CalendarEventOccurrence, now: Date): boolean => {
  const dayStart = startOfUtcDay(now);
  const nextDayStart = addOneDayUtc(dayStart);
  const start = new Date(occurrence.startsAt);
  const end = new Date(occurrence.endsAt);
  return end > dayStart && start < nextDayStart;
};

const formatOccurrenceWindow = (startsAt: string, endsAt: string, isAllDay: boolean): string => {
  if (isAllDay) {
    // All-day events are stored as midnight UTC boundaries; use plain UTC date labels.
    const start = new Date(startsAt);
    const inclusiveEnd = subtractOneDayUtc(new Date(endsAt));
    const startLabel = formatUtcDateLabel(start);
    const endLabel = formatUtcDateLabel(inclusiveEnd);
    return startLabel === endLabel ? `${startLabel} (all day)` : `${startLabel} - ${endLabel} (all day)`;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  // Compare UTC calendar days to decide whether to show the date once or for both endpoints.
  const startUtcDate = formatUtcDateLabel(start);
  const endUtcDate = formatUtcDateLabel(end);

  if (startUtcDate === endUtcDate) {
    // Same UTC calendar day: show the date once, then the start–end time range.
    const datePart = slackTimestamp(start, '{date_short}', startUtcDate);
    const startTime = slackTimestamp(start, '{time}', formatUtcTimeLabel(start));
    const endTime = slackTimestamp(end, '{time}', formatUtcTimeLabel(end));
    return `${datePart}, ${startTime} - ${endTime}`;
  }

  // Different UTC calendar days: include date and time for both endpoints.
  const startFallback = `${startUtcDate} at ${formatUtcTimeLabel(start)}`;
  const endFallback = `${endUtcDate} at ${formatUtcTimeLabel(end)}`;
  return `${slackTimestamp(start, '{date_short} at {time}', startFallback)} - ${slackTimestamp(end, '{date_short} at {time}', endFallback)}`;
};

const formatOccurrenceLine = (occurrence: CalendarEventOccurrence): string => {
  const locationSuffix = occurrence.location ? ` @ ${occurrence.location}` : '';
  const occurrenceWindow = formatOccurrenceWindow(occurrence.startsAt, occurrence.endsAt, occurrence.isAllDay);
  return `- ${occurrenceWindow} - ${occurrence.title}${locationSuffix}`;
};

const formatAlertSection = (title: string, occurrences: CalendarEventOccurrence[]): string | null => {
  if (!occurrences.length) {
    return null;
  }

  return `${title}:\n${occurrences.map(formatOccurrenceLine).join('\n')}`;
};

const formatAlertMessage = (emoji: string, title: string, occurrences: CalendarEventOccurrence[]): string | null => {
  const section = formatAlertSection(title, occurrences);
  if (!section) {
    return null;
  }
  return `${emoji} ${section}`;
};

export class EventAlertJob {
  private calendarPersistenceService = new CalendarPersistenceService();
  private webService = new WebService();
  private redisService = RedisPersistenceService.getInstance();
  private jobLogger = logger.child({ module: 'EventAlertJob' });

  async run(now = new Date()): Promise<void> {
    const windowEnd = new Date(now.getTime() + ALERT_LOOKAHEAD_MS);

    try {
      const teamOccurrences = await this.calendarPersistenceService.listUpcomingOccurrences(now, windowEnd);

      if (!teamOccurrences.some(({ occurrences }) => occurrences.length > 0)) {
        this.jobLogger.info('No upcoming calendar events found for alert window.', {
          windowStart: now.toISOString(),
          windowEnd: windowEnd.toISOString(),
        });
        return;
      }

      await Promise.all(
        teamOccurrences.map(async ({ teamId, occurrences: upcomingOccurrences }) => {
          if (!upcomingOccurrences.length) {
            return;
          }

          const dedupeResults = await Promise.all(
            upcomingOccurrences.map(async (occurrence) => {
              const dedupeKey = `calendar-alert:${occurrence.occurrenceId}`;
              const existing = await this.redisService.getValue(dedupeKey);
              return { occurrence, existing };
            }),
          );

          const unsentOccurrences = dedupeResults
            .filter(({ existing }) => !existing)
            .map(({ occurrence }) => occurrence);

          if (!unsentOccurrences.length) {
            this.jobLogger.info('Upcoming events already alerted.', {
              teamId,
              candidateCount: upcomingOccurrences.length,
            });
            return;
          }

          const displayedOccurrences = unsentOccurrences.slice(0, 20);
          const todayOccurrences = displayedOccurrences.filter((occurrence) => occursTodayUtc(occurrence, now));
          const upcomingOccurrencesLater = displayedOccurrences.filter(
            (occurrence) => !occursTodayUtc(occurrence, now),
          );

          const overflowCount = unsentOccurrences.length - displayedOccurrences.length;
          const overflowLine = overflowCount > 0 ? `\n...and ${overflowCount} more event(s).` : '';
          const upcomingMessage = formatAlertMessage(
            ':hourglass_flowing_sand:',
            'Upcoming in the next 24 hours',
            upcomingOccurrencesLater,
          );
          const todayMessage = formatAlertMessage(':sunny:', 'Happening today', todayOccurrences);

          if (upcomingMessage) {
            await this.webService.sendMessage(ALERT_CHANNEL, `${upcomingMessage}${overflowLine}`);
          }

          // Always send today alerts last when both buckets have events.
          if (todayMessage) {
            await this.webService.sendMessage(ALERT_CHANNEL, `${todayMessage}${overflowLine}`);
          }

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
            teamId,
            notifiedCount: unsentOccurrences.length,
            windowStart: now.toISOString(),
            windowEnd: windowEnd.toISOString(),
          });
        }),
      );
    } catch (error: unknown) {
      logError(this.jobLogger, 'Event alert job failed', error, {
        windowStart: now.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
      throw error;
    }
  }
}
