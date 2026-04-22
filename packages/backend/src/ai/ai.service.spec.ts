import { vi, it, describe, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AIService } from './ai.service';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { MOONBEAM_SLACK_ID } from './ai.constants';
import { TraitService } from '../trait/trait.service';

const { getAllTraitsForUsers } = vi.hoisted(() => ({
  getAllTraitsForUsers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../trait/trait.persistence.service', async () => ({
  TraitPersistenceService: classMock(() => ({
    getAllTraitsForUsers,
    getAllTraitsForUser: vi.fn().mockResolvedValue([]),
  })),
}));

const buildAiService = (): AIService => {
  const ai = new AIService();

  ai.redis = {
    setInflight: vi.fn().mockResolvedValue('OK'),
    setDailyRequests: vi.fn().mockResolvedValue('OK'),
    getInflight: vi.fn().mockResolvedValue(null),
    getDailyRequests: vi.fn().mockResolvedValue('0'),
    removeInflight: vi.fn().mockResolvedValue(1),
    decrementDailyRequests: vi.fn().mockResolvedValue('0'),
    setParticipationInFlight: vi.fn().mockResolvedValue('OK'),
    removeParticipationInFlight: vi.fn().mockResolvedValue(1),
    setHasParticipated: vi.fn().mockResolvedValue('OK'),
    getExtractionLock: vi.fn().mockResolvedValue(null),
    setExtractionLock: vi.fn().mockResolvedValue('OK'),
  } as unknown as AIService['redis'];

  ai.openAi = {
    responses: {
      create: vi.fn(),
    },
  } as unknown as AIService['openAi'];

  ai.gemini = {
    models: {
      generateContent: vi.fn(),
    },
  } as unknown as AIService['gemini'];

  ai.historyService = {
    getHistory: vi.fn().mockResolvedValue([]),
    getHistoryWithOptions: vi.fn().mockResolvedValue([]),
    getLast24HoursForChannel: vi.fn().mockResolvedValue([]),
  } as unknown as AIService['historyService'];

  ai.webService = {
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
    setProfilePhoto: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as AIService['webService'];

  ai.slackService = {
    containsTag: vi.fn(),
    isUserMentioned: vi.fn(),
  } as unknown as AIService['slackService'];

  ai.muzzlePersistenceService = {
    isUserMuzzled: vi.fn().mockResolvedValue(false),
  } as unknown as AIService['muzzlePersistenceService'];

  ai.slackPersistenceService = {
    getCustomPrompt: vi.fn().mockResolvedValue(null),
  } as unknown as AIService['slackPersistenceService'];

  ai.aiServiceLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as AIService['aiServiceLogger'];

  ai.traitService = new TraitService();

  return ai;
};

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = buildAiService();
  });

  describe('formatHistory', () => {
    it('formats messages with timestamps and slack ids', () => {
      const history: MessageWithName[] = [
        { name: 'John', slackId: 'U001', message: 'Hello', createdAt: new Date('2024-01-15T10:30:00') },
      ] as MessageWithName[];

      const result = aiService.formatHistory(history);

      expect(result).toContain('John (U001): Hello');
      expect(result).toMatch(/\[\d{2}:\d{2}\s[AP]M\]/);
    });

    it('returns a placeholder for empty history', () => {
      expect(aiService.formatHistory([])).toBe('[No recent messages in channel]');
    });
  });

  describe('generateText', () => {
    it('tracks inflight state, calls OpenAI responses API, and sends output', async () => {
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Generated text' }] }],
      });
      const sendSpy = vi.spyOn(aiService, 'sendGptText').mockImplementation();

      await aiService.generateText('U1', 'T1', 'C1', 'hello');

      expect(aiService.redis.setInflight).toHaveBeenCalledWith('U1', 'T1');
      expect(aiService.redis.setDailyRequests).toHaveBeenCalledWith('U1', 'T1');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tools: [{ type: 'web_search_preview' }], tool_choice: 'auto' }),
      );
      expect(aiService.redis.removeInflight).toHaveBeenCalledWith('U1', 'T1');
      expect(sendSpy).toHaveBeenCalledWith('Generated text', 'U1', 'T1', 'C1', 'hello');
    });

    it('decrements requests when OpenAI call fails', async () => {
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockRejectedValue(new Error('boom'));

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow('boom');

      expect(aiService.redis.removeInflight).toHaveBeenCalledWith('U1', 'T1');
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });
  });

  describe('generateImage', () => {
    it('sends generated image after writing it to disk', async () => {
      const generateContentSpy = aiService.gemini.models.generateContent as Mock;
      generateContentSpy.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: Buffer.from('fake-image').toString('base64') } }],
            },
          },
        ],
      });

      const diskSpy = vi.spyOn(aiService, 'writeToDiskAndReturnUrl').mockResolvedValue('https://muzzle.lol/image.png');
      const sendSpy = vi.spyOn(aiService, 'sendImage').mockImplementation();

      await aiService.generateImage('U1', 'T1', 'C1', 'draw cat');

      expect(generateContentSpy).toHaveBeenCalled();
      expect(diskSpy).toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith('https://muzzle.lol/image.png', 'U1', 'T1', 'C1', 'draw cat');
    });

    it('logs and throws when gemini returns no image data', async () => {
      (aiService.gemini.models.generateContent as Mock).mockResolvedValue({
        candidates: [{ content: { parts: [] } }],
      });
      const errSpy = vi.spyOn(aiService.aiServiceLogger, 'error');

      await expect(aiService.generateImage('U1', 'T1', 'C1', 'draw cat')).rejects.toThrow();
      expect(errSpy).toHaveBeenCalled();
    });
  });

  describe('writeToDiskAndReturnUrl', () => {
    it('creates the image directory before writing the file', async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-service-'));
      const imageDir = path.join(tempRoot, 'nested', 'images');
      const originalImageDir = process.env.IMAGE_DIR;

      process.env.IMAGE_DIR = imageDir;

      try {
        const imageUrl = await aiService.writeToDiskAndReturnUrl(Buffer.from('png-bytes').toString('base64'));
        const filename = imageUrl.split('/').pop();

        expect(filename).toBeDefined();
        expect(fs.existsSync(imageDir)).toBe(true);
        expect(fs.readFileSync(path.join(imageDir, filename as string))).toEqual(Buffer.from('png-bytes'));
      } finally {
        if (originalImageDir === undefined) {
          delete process.env.IMAGE_DIR;
        } else {
          process.env.IMAGE_DIR = originalImageDir;
        }

        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });
  });

  describe('redeployMoonbeam', () => {
    it('publishes deployment message with quote, changelog, and profile photo update', async () => {
      const validPngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',
        'base64',
      );

      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'A quote' }] }],
      });
      (aiService.gemini.models.generateContent as Mock).mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: { data: validPngBuffer.toString('base64') } }] } }],
      });
      vi.spyOn(aiService as never, 'getMoonbeamReleaseChangelog' as never).mockResolvedValue(
        '*Release changelog*\n- tightened auth',
      );

      const diskSpy = vi
        .spyOn(aiService as never, 'writeImageBufferToDiskAndReturnUrl' as never)
        .mockResolvedValue('https://muzzle.lol/deploy.png');

      await aiService.redeployMoonbeam();

      expect(diskSpy).toHaveBeenCalled();
      expect(aiService.webService.setProfilePhoto).toHaveBeenCalledWith(expect.any(Buffer));
      expect(aiService.webService.sendMessage).toHaveBeenCalledWith(
        '#muzzlefeedback',
        'Moonbeam has been deployed.',
        expect.arrayContaining([
          expect.objectContaining({ type: 'image', image_url: 'https://muzzle.lol/deploy.png' }),
          expect.objectContaining({ type: 'markdown', text: '"A quote"' }),
          expect.objectContaining({ type: 'markdown', text: '*Release changelog*\n- tightened auth' }),
        ]),
      );
    });

    it('returns an unavailable changelog when no metadata source is available', async () => {
      vi.spyOn(aiService as never, 'readReleaseMetadataFromDisk' as never).mockResolvedValue(null);
      vi.spyOn(aiService as never, 'readReleaseMetadataFromGit' as never).mockResolvedValue(null);

      await expect((aiService as never).getMoonbeamReleaseChangelog()).resolves.toBe(
        '*Release changelog*\n- Changelog unavailable for this deployment.',
      );
    });

    it('formats changelog entries without a previous sha', async () => {
      vi.spyOn(aiService as never, 'readReleaseMetadataFromDisk' as never).mockResolvedValue({
        currentSha: 'current',
        previousSha: null,
        commits: [
          { sha: '1', subject: 'first change' },
          { sha: '2', subject: 'second change' },
        ],
      });

      await expect((aiService as never).getMoonbeamReleaseChangelog()).resolves.toBe(
        '*Release changelog*\nRecent shipped changes:\n- first change\n- second change',
      );
    });

    it('reads release metadata from disk after skipping invalid candidates', async () => {
      const readFileSpy = vi
        .spyOn(fs.promises, 'readFile')
        .mockRejectedValueOnce(new Error('missing'))
        .mockResolvedValueOnce('not json' as never)
        .mockResolvedValueOnce(
          JSON.stringify({
            currentSha: 'abc1234',
            previousSha: 'def5678',
            commits: [{ sha: 'abc1234', subject: 'ship it' }],
          }) as never,
        );

      await expect((aiService as never).readReleaseMetadataFromDisk()).resolves.toEqual({
        currentSha: 'abc1234',
        previousSha: 'def5678',
        commits: [{ sha: 'abc1234', subject: 'ship it' }],
      });
      expect(readFileSpy).toHaveBeenCalledTimes(3);
    });

    it('parses release metadata and filters invalid commits', () => {
      expect((aiService as never).parseReleaseMetadata(null)).toBeNull();
      expect(
        (aiService as never).parseReleaseMetadata({
          currentSha: 'abc1234',
          previousSha: 'def5678',
          commits: [{ sha: 'good', subject: 'usable' }, { nope: true }, null],
        }),
      ).toEqual({
        currentSha: 'abc1234',
        previousSha: 'def5678',
        commits: [{ sha: 'good', subject: 'usable' }],
      });
    });
  });

  describe('promptWithHistory', () => {
    it('fetches history and posts a prompt response', async () => {
      (aiService.historyService.getHistory as Mock).mockResolvedValue([
        { name: 'Jane', slackId: 'U2', message: 'Hi there' },
      ]);
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response text' }] }],
      });

      await aiService.promptWithHistory({
        user_id: 'U1',
        team_id: 'T1',
        channel_id: 'C1',
        text: 'Summarize',
      } as never);

      expect(aiService.historyService.getHistory).toHaveBeenCalled();
      expect(aiService.openAi.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({ tools: [{ type: 'web_search_preview' }], tool_choice: 'auto' }),
      );
      expect(aiService.webService.sendMessage).toHaveBeenCalledWith('C1', 'Summarize', expect.any(Array));
    });

    it('warns when prompt response is empty', async () => {
      (aiService.historyService.getHistory as Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as Mock).mockResolvedValue({ output: [] });
      const warnSpy = vi.spyOn(aiService.aiServiceLogger, 'warn');

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'Summarize' } as never);

      expect(warnSpy).toHaveBeenCalled();
    });

    it('sends fallback DM if posting to channel fails', async () => {
      (aiService.historyService.getHistory as Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response text' }] }],
      });
      const send = aiService.webService.sendMessage as Mock;
      send.mockRejectedValueOnce(new Error('channel fail')).mockResolvedValueOnce({ ok: true });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'Summarize' } as never);
      await Promise.resolve();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenLastCalledWith(
        'U1',
        expect.stringContaining('unable to send the requested text to Slack'),
      );
    });

    it('injects trait context when traits exist for participants', async () => {
      (aiService.historyService.getHistory as Mock).mockResolvedValue([
        { name: 'Jane', slackId: 'U2', message: 'Hi there' },
      ]);
      const traitPersistenceService = (
        aiService.traitService as unknown as { traitPersistenceService: { getAllTraitsForUsers: unknown } }
      ).traitPersistenceService;
      (traitPersistenceService.getAllTraitsForUsers as Mock).mockResolvedValue(
        new Map([['U2', [{ slackId: 'U2', content: 'prefers typescript' }]]]),
      );
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response text' }] }],
      });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'Summarize' } as never);

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('traits_context');
      expect(callArgs.instructions).toContain('prefers typescript');
    });
  });

  describe('handle', () => {
    it('participates when Moonbeam is tagged and user is not muzzled', async () => {
      (aiService.slackService.containsTag as Mock).mockReturnValue(true);
      (aiService.slackService.isUserMentioned as Mock).mockReturnValue(true);
      (aiService.muzzlePersistenceService.isUserMuzzled as Mock).mockResolvedValue(false);
      const participateSpy = vi.spyOn(aiService, 'participate').mockResolvedValue();

      await aiService.handle({
        team_id: 'T1',
        event: {
          user: 'U1',
          channel: 'C1',
          text: `<@${MOONBEAM_SLACK_ID}> hello`,
        },
      } as never);

      expect(participateSpy).toHaveBeenCalledWith('T1', 'C1', `<@${MOONBEAM_SLACK_ID}> hello`, 'U1');
    });

    it('does not participate if requesting user is muzzled', async () => {
      (aiService.slackService.containsTag as Mock).mockReturnValue(true);
      (aiService.slackService.isUserMentioned as Mock).mockReturnValue(true);
      (aiService.muzzlePersistenceService.isUserMuzzled as Mock).mockResolvedValue(true);
      const participateSpy = vi.spyOn(aiService, 'participate').mockResolvedValue();

      await aiService.handle({
        team_id: 'T1',
        event: {
          user: 'U1',
          channel: 'C1',
          text: `<@${MOONBEAM_SLACK_ID}> hello`,
        },
      } as never);

      expect(participateSpy).not.toHaveBeenCalled();
    });

    it('does not participate if Moonbeam is not mentioned', async () => {
      (aiService.slackService.containsTag as Mock).mockReturnValue(false);
      (aiService.slackService.isUserMentioned as Mock).mockReturnValue(false);
      const participateSpy = vi.spyOn(aiService, 'participate').mockResolvedValue();

      await aiService.handle({
        team_id: 'T1',
        event: {
          user: 'U1',
          channel: 'C1',
          text: 'just a regular message',
        },
      } as never);

      expect(participateSpy).not.toHaveBeenCalled();
    });
  });

  describe('decrementDaiyRequests', () => {
    it('decrements daily requests for user', async () => {
      (aiService.redis.decrementDailyRequests as Mock).mockResolvedValue('4');

      const result = await aiService.decrementDaiyRequests('U1', 'T1');

      expect(result).toBe('4');
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });

    it('returns null when decrement fails', async () => {
      (aiService.redis.decrementDailyRequests as Mock).mockResolvedValue(null);

      const result = await aiService.decrementDaiyRequests('U1', 'T1');

      expect(result).toBeNull();
    });
  });

  describe('isAlreadyInflight', () => {
    it('returns true if request is inflight', async () => {
      (aiService.redis.getInflight as Mock) = vi.fn().mockResolvedValue('some-request-id');

      const result = await aiService.isAlreadyInflight('U1', 'T1');

      expect(result).toBe(true);
    });

    it('returns false if no inflight request', async () => {
      (aiService.redis.getInflight as Mock) = vi.fn().mockResolvedValue(null);

      const result = await aiService.isAlreadyInflight('U1', 'T1');

      expect(result).toBe(false);
    });
  });

  describe('isAlreadyAtMaxRequests', () => {
    it('returns true if daily requests at max', async () => {
      (aiService.redis.getDailyRequests as Mock) = vi.fn().mockResolvedValue('5');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(true);
    });

    it('returns false if under max requests', async () => {
      (aiService.redis.getDailyRequests as Mock) = vi.fn().mockResolvedValue('3');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(false);
    });

    it('returns false for zero requests', async () => {
      (aiService.redis.getDailyRequests as Mock) = vi.fn().mockResolvedValue('0');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(false);
    });
  });

  describe('generateCorpoSpeak', () => {
    it('generates corporate speak text', async () => {
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Synergistic solutions' }] }],
      });

      const result = await aiService.generateCorpoSpeak('hire more people');

      expect(result).toBe('Synergistic solutions');
      expect(aiService.openAi.responses.create).toHaveBeenCalled();
    });

    it('throws if OpenAI call fails', async () => {
      (aiService.openAi.responses.create as Mock).mockRejectedValue(new Error('API error'));

      await expect(aiService.generateCorpoSpeak('hire more people')).rejects.toThrow('API error');
    });

    it('returns undefined if response structure is unexpected', async () => {
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [],
      });

      const result = await aiService.generateCorpoSpeak('hire more people');

      expect(result).toBeUndefined();
    });
  });

  describe('participate', () => {
    it('should be defined', () => {
      expect(aiService.participate).toBeDefined();
    });

    it('sends participation response and sets participation marker', async () => {
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([
        { slackId: 'U2', name: 'Jane', message: 'Hello' },
      ]);
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Participation response' }] }],
      });
      (aiService.webService.sendMessage as Mock).mockResolvedValue({ ok: true });

      await aiService.participate('T1', 'C1', '<@moonbeam> hi');
      await Promise.resolve();

      expect(aiService.openAi.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({ tools: [{ type: 'web_search_preview' }], tool_choice: 'auto' }),
      );
      expect(aiService.webService.sendMessage).toHaveBeenCalledWith('C1', 'Participation response', [
        { type: 'markdown', text: 'Participation response' },
      ]);
      expect(aiService.redis.setHasParticipated).toHaveBeenCalledWith('T1', 'C1');
      expect(aiService.redis.removeParticipationInFlight).toHaveBeenCalledWith('C1', 'T1');
    });

    it('throws when participate model call fails', async () => {
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as Mock).mockRejectedValue(new Error('model fail'));

      await expect(aiService.participate('T1', 'C1', 'hi')).rejects.toThrow('model fail');
      expect(aiService.redis.removeParticipationInFlight).toHaveBeenCalledWith('C1', 'T1');
    });

    it('injects trait context for participation prompts', async () => {
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([
        { slackId: 'U2', name: 'Jane', message: 'hello' },
      ]);
      const traitPersistenceService = (
        aiService.traitService as unknown as { traitPersistenceService: { getAllTraitsForUsers: unknown } }
      ).traitPersistenceService;
      (traitPersistenceService.getAllTraitsForUsers as Mock).mockResolvedValue(
        new Map([['U2', [{ slackId: 'U2', content: 'dislikes donald trump' }]]]),
      );
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Participation response' }] }],
      });

      await aiService.participate('T1', 'C1', '<@moonbeam> hi');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('traits_context');
      expect(callArgs.instructions).toContain('dislikes donald trump');
    });
  });

  describe('participate with custom prompt', () => {
    it('uses custom prompt as system instructions when userId is provided and user has a custom prompt', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as Mock).mockResolvedValue('always respond in haiku');
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'A haiku response' }] }],
      });

      await aiService.participate('T1', 'C1', 'hi', 'U1');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('always respond in haiku');
    });

    it('uses MOONBEAM_SYSTEM_INSTRUCTIONS when userId is not provided', async () => {
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Default response' }] }],
      });

      await aiService.participate('T1', 'C1', 'hi');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('you are moonbeam');
      expect(aiService.slackPersistenceService.getCustomPrompt).not.toHaveBeenCalled();
    });

    it('uses MOONBEAM_SYSTEM_INSTRUCTIONS when user has no custom prompt', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as Mock).mockResolvedValue(null);
      (aiService.historyService.getHistoryWithOptions as Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Default response' }] }],
      });

      await aiService.participate('T1', 'C1', 'hi', 'U1');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('you are moonbeam');
    });
  });

  describe('promptWithHistory with custom prompt', () => {
    it('prepends custom prompt to history instructions when user has one set', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as Mock).mockResolvedValue('always be brief');
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Brief reply' }] }],
      });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'query' } as never);

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('always be brief');
      expect(callArgs.instructions).toContain('conversation history');
    });

    it('uses only history instructions when no custom prompt is set', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as Mock).mockResolvedValue(null);
      const createSpy = aiService.openAi.responses.create as Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Reply' }] }],
      });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'query' } as never);

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('conversation history');
      expect(callArgs.instructions).not.toContain('always be brief');
    });
  });

  describe('generateText error cases', () => {
    it('handles missing response output gracefully', async () => {
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: undefined,
      });

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow();
    });

    it('handles empty output array', async () => {
      (aiService.openAi.responses.create as Mock).mockResolvedValue({
        output: [],
      });

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow();
    });
  });

  describe('generateImage error cases', () => {
    it('handles Gemini API errors', async () => {
      (aiService.gemini.models.generateContent as Mock).mockRejectedValue(new Error('Gemini error'));

      await expect(aiService.generateImage('U1', 'T1', 'C1', 'draw cat')).rejects.toThrow();
    });

    it('handles missing image data in response', async () => {
      (aiService.gemini.models.generateContent as Mock).mockResolvedValue({
        candidates: [{ content: { parts: [] } }],
      });

      await expect(aiService.generateImage('U1', 'T1', 'C1', 'draw cat')).rejects.toThrow();
    });
  });

  describe('promptWithHistory error cases', () => {
    it('handles history fetch errors', async () => {
      (aiService.historyService.getHistory as Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        aiService.promptWithHistory({
          user_id: 'U1',
          team_id: 'T1',
          channel_id: 'C1',
          text: 'Summarize',
        } as never),
      ).rejects.toThrow();
    });

    it('handles OpenAI errors in promptWithHistory', async () => {
      (aiService.historyService.getHistory as Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as Mock).mockRejectedValue(new Error('OpenAI error'));

      await expect(
        aiService.promptWithHistory({
          user_id: 'U1',
          team_id: 'T1',
          channel_id: 'C1',
          text: 'Summarize',
        } as never),
      ).rejects.toThrow();
    });
  });

  describe('formatHistory edge cases', () => {
    it('handles multiple messages', () => {
      const history: MessageWithName[] = [
        { name: 'Alice', slackId: 'U1', message: 'First', createdAt: new Date() },
        { name: 'Bob', slackId: 'U2', message: 'Second', createdAt: new Date() },
        { name: 'Charlie', slackId: 'U3', message: 'Third', createdAt: new Date() },
      ] as MessageWithName[];

      const result = aiService.formatHistory(history);

      expect(result).toContain('Alice (U1): First');
      expect(result).toContain('Bob (U2): Second');
      expect(result).toContain('Charlie (U3): Third');
    });

    it('handles messages with special characters', () => {
      const history: MessageWithName[] = [
        { name: 'Test', slackId: 'U1', message: 'Hello <@U2> and *bold*', createdAt: new Date() },
      ] as MessageWithName[];

      const result = aiService.formatHistory(history);

      expect(result).toContain('Hello <@U2> and *bold*');
    });
  });

  describe('send helpers', () => {
    it('sendImage posts image block and fallback on slack error', async () => {
      const sendMock = aiService.webService.sendMessage as Mock;
      sendMock.mockRejectedValueOnce(new Error('slack fail')).mockResolvedValueOnce({ ok: true });

      aiService.sendImage('https://img', 'U1', 'T1', 'C1', 'draw cat');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendMock).toHaveBeenCalled();
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });

    it('sendGptText posts markdown and fallback on slack error', async () => {
      const sendMock = aiService.webService.sendMessage as Mock;
      sendMock.mockRejectedValueOnce(new Error('slack fail')).mockResolvedValueOnce({ ok: true });

      aiService.sendGptText('hello world', 'U1', 'T1', 'C1', 'query');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendMock).toHaveBeenCalled();
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });
  });
});
