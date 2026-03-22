import type { Request, Response, Router } from 'express';
import express from 'express';
import type { EventRequest } from '../shared/models/slack/slack-models';
import { EventService } from './event.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const eventController: Router = express.Router();

const eventService = new EventService();
const eventLogger = logger.child({ module: 'EventController' });

eventController.post('/handle', (req: Request, res: Response) => {
  if (req.body.challenge) {
    eventLogger.info('Responding to challenge request');
    res.send({ challenge: req.body.challenge });
  } else {
    const request: EventRequest = req.body;
    eventService.handle(request).catch((error) => {
      logError(eventLogger, 'Failed to handle Slack event', error, {
        eventType: request.event.type,
        teamId: request.team_id,
        channelId: request.event.channel,
        userId: request.event.user,
      });
      return;
    });
    res.status(200).send();
  }
});
