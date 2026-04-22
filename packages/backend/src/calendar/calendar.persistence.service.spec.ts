import { vi } from 'vitest';
import { CalendarPersistenceService } from './calendar.persistence.service';

describe('CalendarPersistenceService', () => {
  it('returns occurrences for old daily recurrences within the requested range', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      {
        id: 'series-1',
        teamId: 'T1',
        createdByUserId: 'U1',
        title: 'Daily sync',
        location: null,
        isAllDay: false,
        startsAt: '2010-01-01T09:00:00.000Z',
        endsAt: '2010-01-01T09:30:00.000Z',
        recurrence: {
          frequency: 'daily',
          interval: 1,
        },
        createdAt: '2010-01-01T09:00:00.000Z',
        updatedAt: '2010-01-01T09:00:00.000Z',
      },
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-21T00:00:00.000Z'),
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      occurrenceId: 'series-1:2026-04-21T09:00:00.000Z',
      seriesId: 'series-1',
      title: 'Daily sync',
      isAllDay: false,
      isRecurring: true,
    });
  });
});
