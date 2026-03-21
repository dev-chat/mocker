import express from 'express';
import request from 'supertest';

const generateText = jest.fn().mockResolvedValue(undefined);
const generateImage = jest.fn().mockResolvedValue(undefined);
const promptWithHistory = jest.fn().mockResolvedValue(undefined);
const sendEphemeral = jest.fn().mockResolvedValue({ ok: true });

jest.mock('./ai.service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    generateText,
    generateImage,
    promptWithHistory,
  })),
}));

jest.mock('../shared/services/web/web.service', () => ({
  WebService: jest.fn().mockImplementation(() => ({
    sendEphemeral,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('./middleware/aiMiddleware', () => ({
  aiMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { aiController } from './ai.controller';

describe('aiController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', aiController);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles /text', async () => {
    await request(app)
      .post('/text')
      .send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'hello' })
      .expect(200);

    expect(generateText).toHaveBeenCalledWith('U1', 'T1', 'C1', 'hello');
  });

  it('handles /image', async () => {
    await request(app).post('/image').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'cat' }).expect(200);

    expect(generateImage).toHaveBeenCalledWith('U1', 'T1', 'C1', 'cat');
  });

  it('handles /prompt-with-history', async () => {
    const body = { user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'sum' };
    await request(app).post('/prompt-with-history').send(body).expect(200);

    expect(promptWithHistory).toHaveBeenCalledWith(body);
  });

  it('sends ephemeral on service errors', async () => {
    generateText.mockRejectedValueOnce(new Error('boom'));

    await request(app)
      .post('/text')
      .send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'hello' })
      .expect(200);

    await Promise.resolve();
    expect(sendEphemeral).toHaveBeenCalled();
  });
});
