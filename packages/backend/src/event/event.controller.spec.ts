import express from 'express';
import request from 'supertest';

const handle = jest.fn().mockResolvedValue(undefined);

jest.mock('./event.service', () => ({
  EventService: jest.fn().mockImplementation(() => ({
    handle,
  })),
}));

import { eventController } from './event.controller';

describe('eventController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', eventController);

  beforeEach(() => jest.clearAllMocks());

  it('responds to challenge', async () => {
    const res = await request(app).post('/handle').send({ challenge: 'abc' }).expect(200);
    expect(res.body).toEqual({ challenge: 'abc' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('handles normal event', async () => {
    const body = { event: { type: 'message' }, team_id: 'T1' };
    await request(app).post('/handle').send(body).expect(200);
    expect(handle).toHaveBeenCalledWith(body);
  });
});
