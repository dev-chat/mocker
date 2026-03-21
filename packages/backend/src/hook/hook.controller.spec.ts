import express from 'express';
import request from 'supertest';

const sendMessage = jest.fn().mockResolvedValue({ ok: true });
const info = jest.fn();

jest.mock('../shared/services/web/web.service', () => ({
  WebService: jest.fn().mockImplementation(() => ({
    sendMessage,
    logger: {
      child: jest.fn().mockReturnValue({ info }),
    },
  })),
}));

import { hookController } from './hook.controller';

describe('hookController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', hookController);

  beforeEach(() => jest.clearAllMocks());

  it('rejects invalid payload', async () => {
    await request(app).post('/').send({}).expect(400);
    expect(info).toHaveBeenCalled();
  });

  it('sends product hook message', async () => {
    await request(app).post('/').send({ message: 'ship it' }).expect(200);
    expect(sendMessage).toHaveBeenCalledWith('#products', 'ship it');
  });

  it('handles send failures', async () => {
    sendMessage.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).post('/').send({ message: 'ship it' }).expect(500);
    expect(res.text).toContain('Error sending message');
  });
});
