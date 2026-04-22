import type { Router } from 'express';
import express from 'express';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';
import { CalendarPersistenceService } from './calendar.persistence.service';
import { parseBody, parseRange } from './calendar.util';

export const calendarController: Router = express.Router();

const calendarPersistenceService = new CalendarPersistenceService();
const calendarLogger = logger.child({ module: 'CalendarController' });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

calendarController.get('/events', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  if (!teamId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const range = parseRange(req.query.start, req.query.end);
  if (!range) {
    res.status(400).json({ error: 'A valid start and end date range is required.' });
    return;
  }

  calendarPersistenceService
    .listSeriesAndOccurrences(teamId, range.start, range.end)
    .then(({ series, occurrences }) => {
      res.status(200).json({ series, occurrences });
    })
    .catch((error: unknown) => {
      logError(calendarLogger, 'Failed to list calendar events', error, { teamId });
      res.status(500).send();
    });
});

calendarController.post('/events', (req: RequestWithAuthSession, res) => {
  const { teamId, userId } = req.authSession || {};
  if (!teamId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const input = parseBody(req.body);
  if (!input) {
    res.status(400).json({ error: 'Invalid payload.' });
    return;
  }

  calendarPersistenceService
    .createSeries(teamId, userId, input)
    .then((event) => res.status(201).json(event))
    .catch((error: unknown) => {
      logError(calendarLogger, 'Failed to create calendar event', error, { teamId, userId });
      res.status(500).send();
    });
});

calendarController.put('/events/:id', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  if (!teamId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = req.params.id;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Invalid event id.' });
    return;
  }

  const input = parseBody(req.body);
  if (!input) {
    res.status(400).json({ error: 'Invalid payload.' });
    return;
  }

  calendarPersistenceService
    .updateSeries(teamId, id, input)
    .then((event) => {
      if (!event) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }

      res.status(200).json(event);
    })
    .catch((error: unknown) => {
      logError(calendarLogger, 'Failed to update calendar event', error, { teamId, id });
      res.status(500).send();
    });
});

calendarController.delete('/events/:id', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  if (!teamId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = req.params.id;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Invalid event id.' });
    return;
  }

  calendarPersistenceService
    .deleteSeries(teamId, id)
    .then((deleted) => {
      if (!deleted) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }

      res.status(204).send();
    })
    .catch((error: unknown) => {
      logError(calendarLogger, 'Failed to delete calendar event', error, { teamId, id });
      res.status(500).send();
    });
});
