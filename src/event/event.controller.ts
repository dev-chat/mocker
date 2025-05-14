import express, { Request, Response, Router } from 'express';
import { EventRequest } from '../shared/models/slack/slack-models';
import { EventService } from './event.service';
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
    eventService.handle(request);
    res.status(200).send();
  }
});
