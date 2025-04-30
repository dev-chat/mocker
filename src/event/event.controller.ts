import express, { Request, Response, Router } from 'express';
import { EventRequest } from '../shared/models/slack/slack-models';
import { EventService } from './event.service';

export const eventController: Router = express.Router();

const eventService = new EventService();

eventController.post('/muzzle/handle', async (req: Request, res: Response) => {
  console.log('Event controller received request:', req.body);
  if (req.body.challenge) {
    res.send({ challenge: req.body.challenge });
  } else {
    console.time('respond-to-event');
    const request: EventRequest = req.body;
    eventService.handle(request);
    console.timeEnd('respond-to-event');
    res.status(200).send();
  }
});
