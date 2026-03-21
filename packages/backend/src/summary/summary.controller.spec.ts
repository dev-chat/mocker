import express from 'express';
import request from 'supertest';
import { summaryController } from './summary.controller';

describe('summaryController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', summaryController);

  it('handles /daily deprecation endpoint', async () => {
    await request(app).post('/daily').send({}).expect(200, 'This is deprecated. Please use /prompt.');
  });

  it('handles / deprecation endpoint', async () => {
    await request(app).post('/').send({}).expect(200, 'This is deprecated. Please use /prompt.');
  });
});
