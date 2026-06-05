import { vi } from 'vitest';

const listUpcomingOccurrencesMock = vi.fn();
const sendMessageMock = vi.fn();
const getValueMock = vi.fn();
const setValueWithExpireMock = vi.fn();

vi.mock('../calendar/calendar.persistence.service', async () => ({
  CalendarPersistenceService: classMock(() => ({
    listUpcomingOccurrences: listUpcomingOccurrencesMock,
  })),
}));

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    sendMessage: sendMessageMock,
  })),
}));

vi.mock('../shared/services/redis.persistence.service', async () => ({
  RedisPersistenceService: {
    getInstance: () => ({
      getValue: getValueMock,
      setValueWithExpire: setValueWithExpireMock,
    }),
  },
}));

import { EventAlertJob } from './event-alert.job';

describe('EventAlertJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValueMock.mockResolvedValue(null);
    setValueWithExpireMock.mockResolvedValue('OK');
    sendMessageMock.mockResolvedValue({ ok: true });
  });

  it('sends a message for upcoming events and writes dedupe keys', async () => {
    listUpcomingOccurrencesMock.mockResolvedValue([
      {
        teamId: 'T123',
        occurrences: [
          {
            occurrenceId: '1:2026-04-21T16:00:00.000Z',
            seriesId: '1',
            title: 'Planning 🚀',
            location: 'HQ',
            startsAt: '2026-04-21T16:00:00.000Z',
            endsAt: '2026-04-21T17:00:00.000Z',
            isAllDay: false,
            isRecurring: false,
          },
        ],
      },
    ]);

    const job = new EventAlertJob();
    await job.run(new Date('2026-04-21T12:00:00.000Z'));

    expect(sendMessageMock).toHaveBeenCalledOnce();
    expect(sendMessageMock).toHaveBeenCalledWith('#events', expect.stringContaining(':sunny: Happening today:\n'));
    expect(sendMessageMock).toHaveBeenCalledWith('#events', expect.stringContaining('Planning 🚀 @ HQ'));
    // Times should use Slack's <!date^…> format so each user sees them in their own Slack timezone.
    // Unix seconds: start=1776787200 (2026-04-21T16:00Z), end=1776790800 (2026-04-21T17:00Z)
    expect(sendMessageMock).toHaveBeenCalledWith(
      '#events',
      expect.stringContaining('<!date^1776787200^{date_short}|Apr 21>'),
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      '#events',
      expect.stringContaining('<!date^1776787200^{time}|4:00 PM>'),
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      '#events',
      expect.stringContaining('<!date^1776790800^{time}|5:00 PM>'),
    );
    expect(setValueWithExpireMock).toHaveBeenCalledOnce();
  });

  it('splits today events from later upcoming events in the same 24 hour window', async () => {
    listUpcomingOccurrencesMock.mockResolvedValue([
      {
        teamId: 'T123',
        occurrences: [
          {
            occurrenceId: '1:2026-04-21T16:00:00.000Z',
            seriesId: '1',
            title: 'Today Planning',
            location: null,
            startsAt: '2026-04-21T16:00:00.000Z',
            endsAt: '2026-04-21T17:00:00.000Z',
            isAllDay: false,
            isRecurring: false,
          },
          {
            occurrenceId: '2:2026-04-22T06:00:00.000Z',
            seriesId: '2',
            title: 'Tomorrow Standup',
            location: 'Zoom',
            startsAt: '2026-04-22T06:00:00.000Z',
            endsAt: '2026-04-22T06:30:00.000Z',
            isAllDay: false,
            isRecurring: false,
          },
        ],
      },
    ]);

    const job = new EventAlertJob();
    await job.run(new Date('2026-04-21T12:00:00.000Z'));

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      1,
      '#events',
      expect.stringContaining(':hourglass_flowing_sand: Upcoming in the next 24 hours:\n- '),
    );
    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      '#events',
      expect.stringContaining(':sunny: Happening today:\n- '),
    );
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, '#events', expect.stringContaining('Tomorrow Standup @ Zoom'));
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, '#events', expect.stringContaining('Today Planning'));
  });

  it('formats all-day multi-day events as date ranges', async () => {
    listUpcomingOccurrencesMock.mockResolvedValue([
      {
        teamId: 'T123',
        occurrences: [
          {
            occurrenceId: 'series-1:2026-04-21T00:00:00.000Z',
            seriesId: 'series-1',
            title: 'Company Retreat',
            location: 'Lodge',
            startsAt: '2026-04-21T00:00:00.000Z',
            endsAt: '2026-04-24T00:00:00.000Z',
            isAllDay: true,
            isRecurring: false,
          },
        ],
      },
    ]);

    const job = new EventAlertJob();
    await job.run(new Date('2026-04-21T12:00:00.000Z'));

    expect(sendMessageMock).toHaveBeenCalledWith(
      '#events',
      expect.stringContaining('Apr 21 - Apr 23 (all day) - Company Retreat @ Lodge'),
    );
  });

  it('does not send duplicate alerts', async () => {
    listUpcomingOccurrencesMock.mockResolvedValue([
      {
        teamId: 'T123',
        occurrences: [
          {
            occurrenceId: '1:2026-04-21T16:00:00.000Z',
            seriesId: '1',
            title: 'Planning',
            location: null,
            startsAt: '2026-04-21T16:00:00.000Z',
            endsAt: '2026-04-21T17:00:00.000Z',
            isAllDay: false,
            isRecurring: false,
          },
        ],
      },
    ]);
    getValueMock.mockResolvedValue('already-sent');

    const job = new EventAlertJob();
    await job.run(new Date('2026-04-21T12:00:00.000Z'));

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(setValueWithExpireMock).not.toHaveBeenCalled();
  });
});
