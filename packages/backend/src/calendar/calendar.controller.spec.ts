import express from 'express';
import request from 'supertest';
import { vi } from 'vitest';

const listSeriesAndOccurrencesMock = vi.fn();
const createSeriesMock = vi.fn();
const updateSeriesMock = vi.fn();
const deleteSeriesMock = vi.fn();

vi.mock('./calendar.persistence.service', async () => ({
  CalendarPersistenceService: classMock(() => ({
    listSeriesAndOccurrences: listSeriesAndOccurrencesMock,
    createSeries: createSeriesMock,
    updateSeries: updateSeriesMock,
    deleteSeries: deleteSeriesMock,
  })),
}));

import { calendarController } from './calendar.controller';

describe('calendarController', () => {
  const eventId = '8f1c2a9f-3e8c-4d2b-b2f8-0a2fdc6ef4a1';
  const missingEventId = '1d0d5c49-8d7d-4d12-9b21-11c4825fb999';

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as { authSession?: { userId: string; teamId: string; exp: number } }).authSession = {
      userId: 'U1',
      teamId: 'T1',
      exp: Date.now() + 60000,
    };
    next();
  });
  app.use('/', calendarController);

  beforeEach(() => vi.clearAllMocks());

  it('lists calendar series and occurrences', async () => {
    listSeriesAndOccurrencesMock.mockResolvedValue({
      series: [{ id: eventId, title: 'Sprint Planning 🚀' }],
      occurrences: [
        {
          occurrenceId: `${eventId}:2026-04-21T12:00:00.000Z`,
          seriesId: eventId,
          title: 'Sprint Planning 🚀',
          location: null,
          startsAt: '2026-04-21T12:00:00.000Z',
          endsAt: '2026-04-21T13:00:00.000Z',
          isAllDay: false,
          isRecurring: false,
        },
      ],
    });

    const res = await request(app)
      .get('/events')
      .query({ start: '2026-04-01T00:00:00.000Z', end: '2026-05-01T00:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(1);
    expect(res.body.occurrences).toHaveLength(1);
    expect(listSeriesAndOccurrencesMock).toHaveBeenCalledWith('T1', expect.any(Date), expect.any(Date));
  });

  it('returns 400 when event range is invalid', async () => {
    const res = await request(app).get('/events').query({ start: 'bad', end: 'also-bad' });

    expect(res.status).toBe(400);
    expect(listSeriesAndOccurrencesMock).not.toHaveBeenCalled();
  });

  it('creates an event with recurrence', async () => {
    createSeriesMock.mockResolvedValue({ id: eventId, title: 'Weekly standup 🧠' });

    const res = await request(app)
      .post('/events')
      .send({
        title: 'Weekly standup 🧠',
        location: 'Room 4B',
        isAllDay: false,
        startsAt: '2026-04-21T17:00:00.000Z',
        endsAt: '2026-04-21T17:30:00.000Z',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          until: '2026-10-01T00:00:00.000Z',
        },
      });

    expect(res.status).toBe(201);
    expect(createSeriesMock).toHaveBeenCalledWith(
      'T1',
      'U1',
      expect.objectContaining({
        title: 'Weekly standup 🧠',
        recurrence: expect.objectContaining({ frequency: 'weekly' }),
      }),
    );
  });

  it('returns 400 for invalid create payload', async () => {
    const res = await request(app).post('/events').send({
      title: '   ',
      isAllDay: false,
      startsAt: '2026-04-21T17:00:00.000Z',
      endsAt: '2026-04-21T16:00:00.000Z',
    });

    expect(res.status).toBe(400);
    expect(createSeriesMock).not.toHaveBeenCalled();
  });

  it('creates a multi-day all-day event from all-day date range inputs', async () => {
    createSeriesMock.mockResolvedValue({ id: eventId, title: 'Office Closed' });

    const res = await request(app).post('/events').send({
      title: 'Office Closed',
      location: 'HQ',
      isAllDay: true,
      allDayStartDate: '2026-04-21',
      allDayEndDate: '2026-04-23',
      recurrence: null,
    });

    expect(res.status).toBe(201);
    expect(createSeriesMock).toHaveBeenCalledWith(
      'T1',
      'U1',
      expect.objectContaining({
        title: 'Office Closed',
        isAllDay: true,
        startsAt: '2026-04-21T00:00:00.000Z',
        endsAt: '2026-04-24T00:00:00.000Z',
      }),
    );
  });

  it('returns 400 when all-day payload is missing required all-day date range', async () => {
    const res = await request(app).post('/events').send({
      title: 'Broken payload',
      isAllDay: true,
      allDayStartDate: '2026-04-22',
      recurrence: null,
    });

    expect(res.status).toBe(400);
    expect(createSeriesMock).not.toHaveBeenCalled();
  });

  it('updates an event', async () => {
    updateSeriesMock.mockResolvedValue({ id: eventId, title: 'Edited title ✨' });

    const res = await request(app).put(`/events/${eventId}`).send({
      title: 'Edited title ✨',
      location: '',
      isAllDay: false,
      startsAt: '2026-04-22T17:00:00.000Z',
      endsAt: '2026-04-22T18:00:00.000Z',
      recurrence: null,
    });

    expect(res.status).toBe(200);
    expect(updateSeriesMock).toHaveBeenCalledWith('T1', eventId, expect.objectContaining({ title: 'Edited title ✨' }));
  });

  it('returns 404 when updating unknown event', async () => {
    updateSeriesMock.mockResolvedValue(null);

    const res = await request(app).put(`/events/${missingEventId}`).send({
      title: 'Edited title',
      location: null,
      isAllDay: false,
      startsAt: '2026-04-22T17:00:00.000Z',
      endsAt: '2026-04-22T18:00:00.000Z',
      recurrence: null,
    });

    expect(res.status).toBe(404);
  });

  it('deletes an event', async () => {
    deleteSeriesMock.mockResolvedValue(true);

    const res = await request(app).delete(`/events/${eventId}`);

    expect(res.status).toBe(204);
    expect(deleteSeriesMock).toHaveBeenCalledWith('T1', eventId);
  });

  it('returns 404 when deleting missing event', async () => {
    deleteSeriesMock.mockResolvedValue(false);

    const res = await request(app).delete(`/events/${missingEventId}`);

    expect(res.status).toBe(404);
  });
});
