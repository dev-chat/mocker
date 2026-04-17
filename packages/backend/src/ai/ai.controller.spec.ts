import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { generateText, generateImage, promptWithHistory, sendEphemeral, setCustomPrompt, clearCustomPrompt } =
  vi.hoisted(() => ({
    generateText: vi.fn().mockResolvedValue(undefined),
    generateImage: vi.fn().mockResolvedValue(undefined),
    promptWithHistory: vi.fn().mockResolvedValue(undefined),
    sendEphemeral: vi.fn().mockResolvedValue({ ok: true }),
    setCustomPrompt: vi.fn().mockResolvedValue(true),
    clearCustomPrompt: vi.fn().mockResolvedValue(true),
  }));

const { getAllTraitsForUser } = vi.hoisted(() => ({
  getAllTraitsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock('./ai.service', async () => ({
  AIService: classMock(() => ({
    generateText,
    generateImage,
    promptWithHistory,
    setCustomPrompt,
    clearCustomPrompt,
  })),
}));

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    sendEphemeral,
  })),
}));

vi.mock('./trait/trait.persistence.service', async () => ({
  TraitPersistenceService: classMock(() => ({
    getAllTraitsForUser,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('./middleware/aiMiddleware', async () => ({
  aiMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { aiController } from './ai.controller';

describe('aiController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', aiController);

  beforeEach(() => {
    vi.clearAllMocks();
    setCustomPrompt.mockResolvedValue(true);
    clearCustomPrompt.mockResolvedValue(true);
    getAllTraitsForUser.mockResolvedValue([]);
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

  describe('/traits', () => {
    it('returns immediate 200 and sends formatted traits ephemerally', async () => {
      getAllTraitsForUser.mockResolvedValue([
        {
          content: 'JR-15 prefers TypeScript as his programming language',
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ]);

      await request(app).post('/traits').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1' }).expect(200);

      await Promise.resolve();

      expect(getAllTraitsForUser).toHaveBeenCalledWith('U1', 'T1');
      expect(sendEphemeral).toHaveBeenCalledWith(
        'C1',
        expect.stringContaining("Moonbeam's core traits about you:"),
        'U1',
      );
    });

    it('sends no-traits message when user has no traits', async () => {
      getAllTraitsForUser.mockResolvedValue([]);

      await request(app).post('/traits').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1' }).expect(200);

      await Promise.resolve();

      expect(sendEphemeral).toHaveBeenCalledWith('C1', "Moonbeam doesn't have any core traits about you yet.", 'U1');
    });

    it('sends fallback error message when trait retrieval fails', async () => {
      getAllTraitsForUser.mockRejectedValueOnce(new Error('db fail'));

      await request(app).post('/traits').send({ user_id: 'U1', team_id: 'T1', channel_id: 'C1' }).expect(200);

      await Promise.resolve();

      expect(sendEphemeral).toHaveBeenCalledWith('C1', 'Sorry, something went wrong fetching your traits.', 'U1');
    });
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
