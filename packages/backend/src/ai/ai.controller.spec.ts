import express from 'express';
import request from 'supertest';

const generateText = jest.fn().mockResolvedValue(undefined);
const generateImage = jest.fn().mockResolvedValue(undefined);
const promptWithHistory = jest.fn().mockResolvedValue(undefined);
const sendEphemeral = jest.fn().mockResolvedValue({ ok: true });
const setCustomPrompt = jest.fn().mockResolvedValue(true);
const clearCustomPrompt = jest.fn().mockResolvedValue(true);

jest.mock('./ai.service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    generateText,
    generateImage,
    promptWithHistory,
    setCustomPrompt,
    clearCustomPrompt,
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
    setCustomPrompt.mockResolvedValue(true);
    clearCustomPrompt.mockResolvedValue(true);
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

  describe('/set-prompt', () => {
    it('clears prompt when text is "clear"', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: 'clear' })
        .expect(200);

      expect(clearCustomPrompt).toHaveBeenCalledWith('U1', 'T1');
      expect(res.text).toContain('cleared');
    });

    it('clears prompt case-insensitively', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: 'CLEAR' })
        .expect(200);

      expect(clearCustomPrompt).toHaveBeenCalledWith('U1', 'T1');
      expect(res.text).toContain('cleared');
    });

    it('clears prompt when text is "clear" with surrounding whitespace', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: '  clear  ' })
        .expect(200);

      expect(clearCustomPrompt).toHaveBeenCalledWith('U1', 'T1');
      expect(res.text).toContain('cleared');
    });

    it('sets custom prompt when text is provided', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: 'respond in rhymes' })
        .expect(200);

      expect(setCustomPrompt).toHaveBeenCalledWith('U1', 'T1', 'respond in rhymes');
      expect(res.text).toContain('set');
    });

    it('trims whitespace before saving the prompt', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: '  respond in rhymes  ' })
        .expect(200);

      expect(setCustomPrompt).toHaveBeenCalledWith('U1', 'T1', 'respond in rhymes');
      expect(res.text).toContain('set');
    });

    it('rejects whitespace-only prompt', async () => {
      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: '   ' })
        .expect(200);

      expect(setCustomPrompt).not.toHaveBeenCalled();
      expect(res.text).toContain('Please provide a prompt');
    });

    it('handles empty text (no args sent by Slack)', async () => {
      const res = await request(app).post('/set-prompt').send({ user_id: 'U1', team_id: 'T1', text: '' }).expect(200);

      expect(setCustomPrompt).not.toHaveBeenCalled();
      expect(res.text).toContain('Please provide a prompt');
    });

    it('rejects prompt exceeding max length', async () => {
      const longPrompt = 'a'.repeat(801);

      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: longPrompt })
        .expect(200);

      expect(setCustomPrompt).not.toHaveBeenCalled();
      expect(res.text).toContain('exceed');
    });

    it('returns failure message when setCustomPrompt fails', async () => {
      setCustomPrompt.mockResolvedValue(false);

      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: 'respond in rhymes' })
        .expect(200);

      expect(res.text).toContain('Failed');
    });

    it('returns failure message when clearCustomPrompt fails', async () => {
      clearCustomPrompt.mockResolvedValue(false);

      const res = await request(app)
        .post('/set-prompt')
        .send({ user_id: 'U1', team_id: 'T1', text: 'clear' })
        .expect(200);

      expect(res.text).toContain('Failed');
    });
  });
});
