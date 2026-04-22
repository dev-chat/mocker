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
    expect(sendMessageMock).toHaveBeenCalledWith('#events', expect.stringContaining('Planning 🚀 @ HQ'));
    expect(setValueWithExpireMock).toHaveBeenCalledOnce();
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
