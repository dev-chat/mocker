import express from 'express';
import request from 'supertest';
import { healthController } from './health.controller';

describe('healthController', () => {
  const app = express();
  app.use('/', healthController);

  it('returns healthy', async () => {
    await request(app).get('/').expect(200, 'healthy');
  });
});
