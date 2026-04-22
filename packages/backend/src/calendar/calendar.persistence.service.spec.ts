import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { CalendarPersistenceService } from './calendar.persistence.service';
import type { CalendarEventSeries } from './calendar.model';
import { CalendarEvent } from '../shared/db/models/CalendarEvent';
import { SlackUser } from '../shared/db/models/SlackUser';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

const baseSeries = (overrides: Partial<CalendarEventSeries> = {}): CalendarEventSeries => ({
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
  ...overrides,
});

describe('CalendarPersistenceService', () => {
  const calendarRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const slackUserRepo = {
    findOne: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (getRepository as Mock).mockImplementation((model: unknown) => {
      if (model === CalendarEvent) {
        return calendarRepo;
      }

      if (model === SlackUser) {
        return slackUserRepo;
      }

      return {};
    });
  });

  it('returns occurrences for old daily recurrences within the requested range', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([baseSeries()]);

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

  it('returns all-day occurrences with all-day metadata and range intersection', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        id: 'series-2',
        title: 'Offsite',
        isAllDay: true,
        startsAt: '2026-04-21T00:00:00.000Z',
        endsAt: '2026-04-24T00:00:00.000Z',
        recurrence: null,
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-22T00:00:00.000Z'),
      new Date('2026-04-23T00:00:00.000Z'),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      seriesId: 'series-2',
      isAllDay: true,
      isRecurring: false,
    });
  });

  it('respects recurrence until date', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        recurrence: {
          frequency: 'daily',
          interval: 1,
          until: '2026-04-20T09:00:00.000Z',
        },
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-21T00:00:00.000Z'),
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(occurrences).toHaveLength(0);
  });

  it('supports weekly intervals greater than one', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        startsAt: '2026-04-07T09:00:00.000Z',
        endsAt: '2026-04-07T10:00:00.000Z',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-21T00:00:00.000Z'),
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].startsAt).toBe('2026-04-21T09:00:00.000Z');
  });

  it('supports monthly recurrence in-range expansion', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        startsAt: '2026-01-15T10:00:00.000Z',
        endsAt: '2026-01-15T11:00:00.000Z',
        recurrence: {
          frequency: 'monthly',
          interval: 1,
        },
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(occurrences.some((item) => item.startsAt === '2026-04-15T10:00:00.000Z')).toBe(true);
  });

  it('supports yearly recurrence in-range expansion', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        startsAt: '2020-04-21T08:00:00.000Z',
        endsAt: '2020-04-21T09:00:00.000Z',
        recurrence: {
          frequency: 'yearly',
          interval: 2,
        },
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(occurrences.some((item) => item.startsAt === '2026-04-21T08:00:00.000Z')).toBe(true);
  });

  it('handles legacy events missing startsAt/endsAt by using createdAt window', async () => {
    const service = new CalendarPersistenceService();
    vi.spyOn(service, 'listSeries').mockResolvedValue([
      baseSeries({
        startsAt: null,
        endsAt: null,
        recurrence: null,
        createdAt: '2026-04-21T00:00:00.000Z',
      }),
    ]);

    const occurrences = await service.listOccurrences(
      'T1',
      new Date('2026-04-21T00:00:00.000Z'),
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].startsAt).toBe('2026-04-21T00:00:00.000Z');
    expect(occurrences[0].endsAt).toBe('2026-04-22T00:00:00.000Z');
  });

  it('maps DB entities in listSeries including parsed recurrence', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.find.mockResolvedValue([
      {
        id: 'series-db',
        title: 'From DB',
        location: 'HQ',
        isAllDay: false,
        startsAt: new Date('2026-04-21T09:00:00.000Z'),
        endsAt: new Date('2026-04-21T10:00:00.000Z'),
        recurrenceRule: JSON.stringify({ frequency: 'weekly', interval: 2, until: '2026-06-01T00:00:00.000Z' }),
        createdAt: new Date('2026-04-20T09:00:00.000Z'),
        updatedAt: new Date('2026-04-20T09:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
      {
        id: 'series-db-invalid-rule',
        title: 'No recurrence',
        location: null,
        isAllDay: true,
        startsAt: null,
        endsAt: null,
        recurrenceRule: 'not-json',
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
    ]);

    const result = await service.listSeries('T1');

    expect(calendarRepo.find).toHaveBeenCalledWith({
      where: { createdByUser: { teamId: 'T1' } },
      relations: ['createdByUser'],
      order: { startsAt: 'ASC' },
    });
    expect(result[0].recurrence).toEqual({
      frequency: 'weekly',
      interval: 2,
      until: '2026-06-01T00:00:00.000Z',
    });
    expect(result[1].recurrence).toBeNull();
  });

  it('throws when listSeries repository fails', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.find.mockRejectedValueOnce(new Error('db-down'));

    await expect(service.listSeries('T1')).rejects.toThrow('db-down');
  });

  it('gracefully nulls malformed recurrence payloads from DB rows', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.find.mockResolvedValue([
      {
        id: 'bad-frequency',
        title: 'Bad frequency',
        location: null,
        isAllDay: false,
        startsAt: new Date('2026-04-21T09:00:00.000Z'),
        endsAt: new Date('2026-04-21T10:00:00.000Z'),
        recurrenceRule: JSON.stringify({ frequency: 'hourly', interval: 1 }),
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
      {
        id: 'bad-interval',
        title: 'Bad interval',
        location: null,
        isAllDay: false,
        startsAt: new Date('2026-04-21T09:00:00.000Z'),
        endsAt: new Date('2026-04-21T10:00:00.000Z'),
        recurrenceRule: JSON.stringify({ frequency: 'daily', interval: 0 }),
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
      {
        id: 'bad-until',
        title: 'Bad until',
        location: null,
        isAllDay: false,
        startsAt: new Date('2026-04-21T09:00:00.000Z'),
        endsAt: new Date('2026-04-21T10:00:00.000Z'),
        recurrenceRule: JSON.stringify({ frequency: 'daily', interval: 1, until: 12345 }),
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
    ]);

    const result = await service.listSeries('T1');
    expect(result).toHaveLength(3);
    expect(result.every((item) => item.recurrence === null)).toBe(true);
  });

  it('creates a series and returns mapped data', async () => {
    const service = new CalendarPersistenceService();
    const input = {
      title: 'Created Event',
      location: 'HQ',
      isAllDay: false,
      startsAt: '2026-04-22T09:00:00.000Z',
      endsAt: '2026-04-22T10:00:00.000Z',
      recurrence: { frequency: 'daily' as const, interval: 1 },
    };

    const user = { slackId: 'U1', teamId: 'T1' };
    const entity = {
      createdByUser: user,
      title: input.title,
      location: input.location,
      isAllDay: input.isAllDay,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      recurrenceRule: JSON.stringify(input.recurrence),
    };
    const savedEntity = {
      ...entity,
      id: 'new-id',
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-20T00:00:00.000Z'),
    };

    slackUserRepo.findOne.mockResolvedValue(user);
    calendarRepo.create.mockReturnValue(entity);
    calendarRepo.save.mockResolvedValue(savedEntity);

    const result = await service.createSeries('T1', 'U1', input);

    expect(calendarRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Created Event',
        isAllDay: false,
      }),
    );
    expect(result.id).toBe('new-id');
  });

  it('throws when createSeries cannot find a slack user', async () => {
    const service = new CalendarPersistenceService();
    slackUserRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createSeries('T1', 'U1', {
        title: 'Created Event',
        location: null,
        isAllDay: false,
        startsAt: '2026-04-22T09:00:00.000Z',
        endsAt: '2026-04-22T10:00:00.000Z',
        recurrence: null,
      }),
    ).rejects.toThrow('Unable to find SlackUser');
  });

  it('updates and deletes series by id and team scope', async () => {
    const service = new CalendarPersistenceService();
    const existing = {
      id: 'series-existing',
      title: 'Old',
      location: null,
      isAllDay: false,
      startsAt: new Date('2026-04-22T09:00:00.000Z'),
      endsAt: new Date('2026-04-22T10:00:00.000Z'),
      recurrenceRule: null,
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-20T00:00:00.000Z'),
      createdByUser: { teamId: 'T1', slackId: 'U1' },
    };

    calendarRepo.findOne.mockResolvedValue(existing);
    calendarRepo.save.mockResolvedValue({ ...existing, title: 'Updated' });

    const updated = await service.updateSeries('T1', 'series-existing', {
      title: 'Updated',
      location: 'Room A',
      isAllDay: true,
      startsAt: null,
      endsAt: null,
      recurrence: { frequency: 'monthly', interval: 1 },
    });

    expect(updated?.title).toBe('Updated');
    expect(calendarRepo.save).toHaveBeenCalled();

    calendarRepo.remove.mockResolvedValue(undefined);
    const deleted = await service.deleteSeries('T1', 'series-existing');
    expect(deleted).toBe(true);
    expect(calendarRepo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'series-existing' }));
  });

  it('returns null/false when update or delete target does not exist', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.findOne.mockResolvedValue(null);

    const updated = await service.updateSeries('T1', 'missing', {
      title: 'Updated',
      location: null,
      isAllDay: false,
      startsAt: '2026-04-22T09:00:00.000Z',
      endsAt: '2026-04-22T10:00:00.000Z',
      recurrence: null,
    });
    const deleted = await service.deleteSeries('T1', 'missing');

    expect(updated).toBeNull();
    expect(deleted).toBe(false);
  });

  it('rethrows update/delete repository failures', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.findOne.mockRejectedValueOnce(new Error('update-find-fail'));

    await expect(
      service.updateSeries('T1', 'series-existing', {
        title: 'Updated',
        location: null,
        isAllDay: false,
        startsAt: '2026-04-22T09:00:00.000Z',
        endsAt: '2026-04-22T10:00:00.000Z',
        recurrence: null,
      }),
    ).rejects.toThrow('update-find-fail');

    calendarRepo.findOne.mockRejectedValueOnce(new Error('delete-find-fail'));
    await expect(service.deleteSeries('T1', 'series-existing')).rejects.toThrow('delete-find-fail');
  });

  it('lists upcoming occurrences from all teams and sorts by startsAt', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.find.mockResolvedValue([
      {
        id: 'series-a',
        title: 'Later',
        location: null,
        isAllDay: false,
        startsAt: new Date('2026-04-21T12:00:00.000Z'),
        endsAt: new Date('2026-04-21T13:00:00.000Z'),
        recurrenceRule: null,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T1', slackId: 'U1' },
      },
      {
        id: 'series-b',
        title: 'Sooner',
        location: null,
        isAllDay: false,
        startsAt: new Date('2026-04-21T09:00:00.000Z'),
        endsAt: new Date('2026-04-21T10:00:00.000Z'),
        recurrenceRule: null,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        createdByUser: { teamId: 'T2', slackId: 'U2' },
      },
    ]);

    const upcoming = await service.listUpcomingOccurrences(
      new Date('2026-04-21T00:00:00.000Z'),
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].title).toBe('Sooner');
    expect(upcoming[1].title).toBe('Later');
  });

  it('throws when listUpcomingOccurrences repository fails', async () => {
    const service = new CalendarPersistenceService();
    calendarRepo.find.mockRejectedValueOnce(new Error('upcoming-failure'));

    await expect(
      service.listUpcomingOccurrences(new Date('2026-04-21T00:00:00.000Z'), new Date('2026-04-22T00:00:00.000Z')),
    ).rejects.toThrow('upcoming-failure');
  });
});
