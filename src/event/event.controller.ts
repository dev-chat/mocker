import express, { Request, Response, Router } from 'express';
import { EventRequest } from '../shared/models/slack/slack-models';
import { EventService } from './event.service';

export const eventController: Router = express.Router();

const eventService = new EventService();

eventController.post('/handle', (req: Request, res: Response) => {
  console.log('Event controller received request:', req.body);
  if (req.body.challenge) {
    res.send({ challenge: req.body.challenge });
  } else {
    const request: EventRequest = req.body;
    eventService.handle(request);
    res.status(200).send();
  }
});
