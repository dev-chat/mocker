import fs from 'fs';
import os from 'os';
import path from 'path';
import { AIService } from './ai.service';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { MOONBEAM_SLACK_ID } from './ai.constants';

const buildAiService = (): AIService => {
  const ai = new AIService();

  ai.redis = {
    setInflight: jest.fn().mockResolvedValue('OK'),
    setDailyRequests: jest.fn().mockResolvedValue('OK'),
    getInflight: jest.fn().mockResolvedValue(null),
    getDailyRequests: jest.fn().mockResolvedValue('0'),
    removeInflight: jest.fn().mockResolvedValue(1),
    decrementDailyRequests: jest.fn().mockResolvedValue('0'),
    setParticipationInFlight: jest.fn().mockResolvedValue('OK'),
    removeParticipationInFlight: jest.fn().mockResolvedValue(1),
    setHasParticipated: jest.fn().mockResolvedValue('OK'),
    getExtractionLock: jest.fn().mockResolvedValue(null),
    setExtractionLock: jest.fn().mockResolvedValue('OK'),
  } as unknown as AIService['redis'];

  ai.openAi = {
    responses: {
      create: jest.fn(),
    },
  } as unknown as AIService['openAi'];

  ai.gemini = {
    models: {
      generateContent: jest.fn(),
    },
  } as unknown as AIService['gemini'];

  ai.memoryPersistenceService = {
    getAllMemoriesForUsers: jest.fn().mockResolvedValue(new Map()),
    saveMemories: jest.fn().mockResolvedValue([]),
    reinforceMemory: jest.fn().mockResolvedValue(true),
    deleteMemory: jest.fn().mockResolvedValue(true),
  } as unknown as AIService['memoryPersistenceService'];

  ai.historyService = {
    getHistory: jest.fn().mockResolvedValue([]),
    getHistoryWithOptions: jest.fn().mockResolvedValue([]),
    getLast24HoursForChannel: jest.fn().mockResolvedValue([]),
  } as unknown as AIService['historyService'];

  ai.webService = {
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
    setProfilePhoto: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as AIService['webService'];

  ai.slackService = {
    containsTag: jest.fn(),
    isUserMentioned: jest.fn(),
  } as unknown as AIService['slackService'];

  ai.muzzlePersistenceService = {
    isUserMuzzled: jest.fn().mockResolvedValue(false),
  } as unknown as AIService['muzzlePersistenceService'];

  ai.slackPersistenceService = {
    getCustomPrompt: jest.fn().mockResolvedValue(null),
  } as unknown as AIService['slackPersistenceService'];

  ai.aiServiceLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as unknown as AIService['aiServiceLogger'];

  return ai;
};

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
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
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Generated text' }] }],
      });
      const sendSpy = jest.spyOn(aiService, 'sendGptText').mockImplementation();

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
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockRejectedValue(new Error('boom'));

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow('boom');

      expect(aiService.redis.removeInflight).toHaveBeenCalledWith('U1', 'T1');
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });
  });

  describe('generateImage', () => {
    it('sends generated image after writing it to disk', async () => {
      const generateContentSpy = aiService.gemini.models.generateContent as jest.Mock;
      generateContentSpy.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: Buffer.from('fake-image').toString('base64') } }],
            },
          },
        ],
      });

      const diskSpy = jest
        .spyOn(aiService, 'writeToDiskAndReturnUrl')
        .mockResolvedValue('https://muzzle.lol/image.png');
      const sendSpy = jest.spyOn(aiService, 'sendImage').mockImplementation();

      await aiService.generateImage('U1', 'T1', 'C1', 'draw cat');

      expect(generateContentSpy).toHaveBeenCalled();
      expect(diskSpy).toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith('https://muzzle.lol/image.png', 'U1', 'T1', 'C1', 'draw cat');
    });

    it('logs and throws when gemini returns no image data', async () => {
      (aiService.gemini.models.generateContent as jest.Mock).mockResolvedValue({
        candidates: [{ content: { parts: [] } }],
      });
      const errSpy = jest.spyOn(aiService.aiServiceLogger, 'error');

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

      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'A quote' }] }],
      });
      (aiService.gemini.models.generateContent as jest.Mock).mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: { data: validPngBuffer.toString('base64') } }] } }],
      });
      jest
        .spyOn(aiService as never, 'getMoonbeamReleaseChangelog' as never)
        .mockResolvedValue('*Release changelog*\n- tightened auth');

      const diskSpy = jest
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
      jest.spyOn(aiService as never, 'readReleaseMetadataFromDisk' as never).mockResolvedValue(null);
      jest.spyOn(aiService as never, 'readReleaseMetadataFromGit' as never).mockResolvedValue(null);

      await expect((aiService as never).getMoonbeamReleaseChangelog()).resolves.toBe(
        '*Release changelog*\n- Changelog unavailable for this deployment.',
      );
    });

    it('formats changelog entries without a previous sha', async () => {
      jest.spyOn(aiService as never, 'readReleaseMetadataFromDisk' as never).mockResolvedValue({
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
      const readFileSpy = jest
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
      (aiService.historyService.getHistory as jest.Mock).mockResolvedValue([
        { name: 'Jane', slackId: 'U2', message: 'Hi there' },
      ]);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
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
      (aiService.historyService.getHistory as jest.Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({ output: [] });
      const warnSpy = jest.spyOn(aiService.aiServiceLogger, 'warn');

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'Summarize' } as never);

      expect(warnSpy).toHaveBeenCalled();
    });

    it('sends fallback DM if posting to channel fails', async () => {
      (aiService.historyService.getHistory as jest.Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response text' }] }],
      });
      const send = aiService.webService.sendMessage as jest.Mock;
      send.mockRejectedValueOnce(new Error('channel fail')).mockResolvedValueOnce({ ok: true });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'Summarize' } as never);
      await Promise.resolve();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenLastCalledWith(
        'U1',
        expect.stringContaining('unable to send the requested text to Slack'),
      );
    });
  });

  describe('handle', () => {
    it('participates when Moonbeam is tagged and user is not muzzled', async () => {
      (aiService.slackService.containsTag as jest.Mock).mockReturnValue(true);
      (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(true);
      (aiService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(false);
      const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

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
      (aiService.slackService.containsTag as jest.Mock).mockReturnValue(true);
      (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(true);
      (aiService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(true);
      const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

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
      (aiService.slackService.containsTag as jest.Mock).mockReturnValue(false);
      (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(false);
      const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

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
      (aiService.redis.decrementDailyRequests as jest.Mock).mockResolvedValue('4');

      const result = await aiService.decrementDaiyRequests('U1', 'T1');

      expect(result).toBe('4');
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });

    it('returns null when decrement fails', async () => {
      (aiService.redis.decrementDailyRequests as jest.Mock).mockResolvedValue(null);

      const result = await aiService.decrementDaiyRequests('U1', 'T1');

      expect(result).toBeNull();
    });
  });

  describe('isAlreadyInflight', () => {
    it('returns true if request is inflight', async () => {
      (aiService.redis.getInflight as jest.Mock) = jest.fn().mockResolvedValue('some-request-id');

      const result = await aiService.isAlreadyInflight('U1', 'T1');

      expect(result).toBe(true);
    });

    it('returns false if no inflight request', async () => {
      (aiService.redis.getInflight as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await aiService.isAlreadyInflight('U1', 'T1');

      expect(result).toBe(false);
    });
  });

  describe('isAlreadyAtMaxRequests', () => {
    it('returns true if daily requests at max', async () => {
      (aiService.redis.getDailyRequests as jest.Mock) = jest.fn().mockResolvedValue('5');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(true);
    });

    it('returns false if under max requests', async () => {
      (aiService.redis.getDailyRequests as jest.Mock) = jest.fn().mockResolvedValue('3');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(false);
    });

    it('returns false for zero requests', async () => {
      (aiService.redis.getDailyRequests as jest.Mock) = jest.fn().mockResolvedValue('0');

      const result = await aiService.isAlreadyAtMaxRequests('U1', 'T1');

      expect(result).toBe(false);
    });
  });

  describe('generateCorpoSpeak', () => {
    it('generates corporate speak text', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Synergistic solutions' }] }],
      });

      const result = await aiService.generateCorpoSpeak('hire more people');

      expect(result).toBe('Synergistic solutions');
      expect(aiService.openAi.responses.create).toHaveBeenCalled();
    });

    it('throws if OpenAI call fails', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockRejectedValue(new Error('API error'));

      await expect(aiService.generateCorpoSpeak('hire more people')).rejects.toThrow('API error');
    });

    it('returns undefined if response structure is unexpected', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
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
      (aiService.historyService.getHistoryWithOptions as jest.Mock).mockResolvedValue([
        { slackId: 'U2', name: 'Jane', message: 'Hello' },
      ]);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Participation response' }] }],
      });
      (aiService.webService.sendMessage as jest.Mock).mockResolvedValue({ ok: true });

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
      (aiService.historyService.getHistoryWithOptions as jest.Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as jest.Mock).mockRejectedValue(new Error('model fail'));

      await expect(aiService.participate('T1', 'C1', 'hi')).rejects.toThrow('model fail');
      expect(aiService.redis.removeParticipationInFlight).toHaveBeenCalledWith('C1', 'T1');
    });
  });

  describe('participate with custom prompt', () => {
    it('uses custom prompt as system instructions when userId is provided and user has a custom prompt', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as jest.Mock).mockResolvedValue('always respond in haiku');
      (aiService.historyService.getHistoryWithOptions as jest.Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'A haiku response' }] }],
      });

      await aiService.participate('T1', 'C1', 'hi', 'U1');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('always respond in haiku');
    });

    it('uses MOONBEAM_SYSTEM_INSTRUCTIONS when userId is not provided', async () => {
      (aiService.historyService.getHistoryWithOptions as jest.Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Default response' }] }],
      });

      await aiService.participate('T1', 'C1', 'hi');

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('you are moonbeam');
      expect(aiService.slackPersistenceService.getCustomPrompt).not.toHaveBeenCalled();
    });

    it('uses MOONBEAM_SYSTEM_INSTRUCTIONS when user has no custom prompt', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as jest.Mock).mockResolvedValue(null);
      (aiService.historyService.getHistoryWithOptions as jest.Mock).mockResolvedValue([]);
      const createSpy = aiService.openAi.responses.create as jest.Mock;
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
      (aiService.slackPersistenceService.getCustomPrompt as jest.Mock).mockResolvedValue('always be brief');
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Brief reply' }] }],
      });

      await aiService.promptWithHistory({ user_id: 'U1', team_id: 'T1', channel_id: 'C1', text: 'query' } as never);

      const callArgs = createSpy.mock.calls[0][0] as { instructions: string };
      expect(callArgs.instructions).toContain('always be brief');
      expect(callArgs.instructions).toContain('conversation history');
    });

    it('uses only history instructions when no custom prompt is set', async () => {
      (aiService.slackPersistenceService.getCustomPrompt as jest.Mock).mockResolvedValue(null);
      const createSpy = aiService.openAi.responses.create as jest.Mock;
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
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: undefined,
      });

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow();
    });

    it('handles empty output array', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [],
      });

      await expect(aiService.generateText('U1', 'T1', 'C1', 'hello')).rejects.toThrow();
    });
  });

  describe('generateImage error cases', () => {
    it('handles Gemini API errors', async () => {
      (aiService.gemini.models.generateContent as jest.Mock).mockRejectedValue(new Error('Gemini error'));

      await expect(aiService.generateImage('U1', 'T1', 'C1', 'draw cat')).rejects.toThrow();
    });

    it('handles missing image data in response', async () => {
      (aiService.gemini.models.generateContent as jest.Mock).mockResolvedValue({
        candidates: [{ content: { parts: [] } }],
      });

      await expect(aiService.generateImage('U1', 'T1', 'C1', 'draw cat')).rejects.toThrow();
    });
  });

  describe('promptWithHistory error cases', () => {
    it('handles history fetch errors', async () => {
      (aiService.historyService.getHistory as jest.Mock).mockRejectedValue(new Error('DB error'));

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
      (aiService.historyService.getHistory as jest.Mock).mockResolvedValue([]);
      (aiService.openAi.responses.create as jest.Mock).mockRejectedValue(new Error('OpenAI error'));

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

  describe('memory helpers', () => {
    type AiServicePrivate = typeof aiService & {
      extractParticipantSlackIds: (
        messages: Array<{ slackId: string; name: string; message: string }>,
        options: { includeSlackId?: string; excludeSlackIds?: string[] },
      ) => string[];
      formatMemoryContext: (
        memories: Array<{ id: number; slackId: string; content: string }>,
        messages: Array<{ slackId: string; name: string; message: string }>,
      ) => string;
      appendMemoryContext: (base: string, context: string) => string;
      selectRelevantMemories: (
        conversation: string,
        memoryMap: Map<string, Array<{ id: number }>>,
      ) => Promise<unknown[]>;
      fetchMemoryContext: (
        participantIds: string[],
        teamId: string,
        conversation: string,
        messages: Array<{ slackId: string; name: string; message: string }>,
      ) => Promise<string>;
      extractMemories: (teamId: string, channelId: string, history: string, participantIds: string[]) => Promise<void>;
    };

    it('extracts participant slack ids with include/exclude rules', () => {
      const ids = (aiService as unknown as AiServicePrivate).extractParticipantSlackIds(
        [
          { slackId: 'U1', name: 'A', message: 'm1' },
          { slackId: 'U2', name: 'B', message: 'm2' },
          { slackId: 'U2', name: 'B', message: 'm3' },
        ],
        { includeSlackId: 'U3', excludeSlackIds: ['U1'] },
      );

      expect(ids).toEqual(['U2', 'U3']);
    });

    it('formats memory context grouped by participant', () => {
      const text = (aiService as unknown as AiServicePrivate).formatMemoryContext(
        [
          { id: 1, slackId: 'U1', content: 'likes coffee' },
          { id: 2, slackId: 'U2', content: 'works on backend' },
        ],
        [
          { slackId: 'U1', name: 'Alice', message: 'hi' },
          { slackId: 'U2', name: 'Bob', message: 'hello' },
        ],
      );

      expect(text).toContain('Alice');
      expect(text).toContain('likes coffee');
      expect(text).toContain('Bob');
    });

    it('returns base instructions when no memory context', () => {
      const result = (aiService as unknown as AiServicePrivate).appendMemoryContext('base', '');
      expect(result).toBe('base');
    });

    it('inserts memory context before <verification> tag', () => {
      const base = 'some instructions\n<verification>\nchecklist\n</verification>';
      const memory = '<memory_context>\ntest memory\n</memory_context>';
      const result = (aiService as unknown as AiServicePrivate).appendMemoryContext(base, memory);
      expect(result).toContain('test memory');
      expect(result.indexOf('memory_context')).toBeLessThan(result.indexOf('<verification>'));
    });

    it('appends memory context at end when no <verification> tag', () => {
      const base = 'simple instructions without verification';
      const memory = '<memory_context>\ntest memory\n</memory_context>';
      const result = (aiService as unknown as AiServicePrivate).appendMemoryContext(base, memory);
      expect(result).toBe(`${base}\n\n${memory}`);
    });

    it('selects relevant memories from model output ids', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '[1,3]' }] }],
      });
      const map = new Map([
        ['U1', [{ id: 1, slackId: 'U1', content: 'a' }]],
        ['U2', [{ id: 3, slackId: 'U2', content: 'b' }]],
      ]);

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories('conv', map);

      expect(selected).toHaveLength(2);
    });

    it('returns empty memory selection when model response is malformed', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{not-json}' }] }],
      });

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories(
        'conv',
        new Map([['U1', [{ id: 1 }]]]),
      );
      expect(selected).toEqual([]);
    });

    it('returns empty array without calling model when memoriesMap is empty', async () => {
      const createSpy = aiService.openAi.responses.create as jest.Mock;

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories('conv', new Map());

      expect(selected).toEqual([]);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('passes conversation as input and memories as instructions (not duplicated)', async () => {
      const createSpy = aiService.openAi.responses.create as jest.Mock;
      createSpy.mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '[1]' }] }],
      });
      const conversation = 'Alice: hey what is up';
      const map = new Map([['U1', [{ id: 1, slackId: 'U1', content: 'likes tea' }]]]);

      await (aiService as unknown as AiServicePrivate).selectRelevantMemories(conversation, map);

      expect(createSpy).toHaveBeenCalledTimes(1);
      const callArgs = createSpy.mock.calls[0][0] as { instructions: string; input: string };
      expect(callArgs.input).toBe(conversation);
      expect(callArgs.instructions).not.toBe(conversation);
      expect(callArgs.instructions).not.toContain(conversation);
    });

    it('returns empty array and warns when model call throws', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockRejectedValue(new Error('model error'));
      const warnSpy = jest.spyOn(aiService.aiServiceLogger, 'warn');

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories(
        'conv',
        new Map([['U1', [{ id: 1 }]]]),
      );

      expect(selected).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns empty array when model returns non-array JSON', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ids":[1,2]}' }] }],
      });

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories(
        'conv',
        new Map([['U1', [{ id: 1 }]]]),
      );

      expect(selected).toEqual([]);
    });

    it('returns empty array when model returns empty array', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '[]' }] }],
      });

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories(
        'conv',
        new Map([['U1', [{ id: 1 }]]]),
      );

      expect(selected).toEqual([]);
    });

    it('filters out IDs from model response that do not exist in memoriesMap', async () => {
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '[1, 99]' }] }],
      });
      const map = new Map([['U1', [{ id: 1, slackId: 'U1', content: 'likes tea' }]]]);

      const selected = await (aiService as unknown as AiServicePrivate).selectRelevantMemories('conv', map);

      expect(selected).toHaveLength(1);
      expect(selected[0]).toMatchObject({ id: 1 });
    });

    it('fetches memory context end-to-end', async () => {
      (aiService.memoryPersistenceService.getAllMemoriesForUsers as jest.Mock).mockResolvedValue(
        new Map([['U1', [{ id: 1, slackId: 'U1', content: 'likes tea' }]]]),
      );
      jest
        .spyOn(aiService as unknown as AiServicePrivate, 'selectRelevantMemories')
        .mockResolvedValue([{ id: 1, slackId: 'U1', content: 'likes tea' }]);

      const context = await (aiService as unknown as AiServicePrivate).fetchMemoryContext(
        ['U1'],
        'T1',
        'conversation',
        [{ slackId: 'U1', name: 'Alice', message: 'msg' }],
      );

      expect(context).toContain('likes tea');
    });

    it('extractMemories returns early when lock exists', async () => {
      (aiService.redis.getExtractionLock as jest.Mock).mockResolvedValue('1');
      const infoSpy = jest.spyOn(aiService.aiServiceLogger, 'info');

      await (aiService as unknown as AiServicePrivate).extractMemories('T1', 'C1', 'history', ['U1']);

      expect(infoSpy).toHaveBeenCalled();
    });

    it('extractMemories handles NONE response', async () => {
      (aiService.redis.getExtractionLock as jest.Mock).mockResolvedValue(null);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'NONE' }] }],
      });

      await (aiService as unknown as AiServicePrivate).extractMemories('T1', 'C1', 'history', ['U1']);

      expect(aiService.memoryPersistenceService.saveMemories).not.toHaveBeenCalled();
    });

    it('extractMemories processes NEW, REINFORCE and EVOLVE modes', async () => {
      (aiService.redis.getExtractionLock as jest.Mock).mockResolvedValue(null);
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify([
                  { slackId: 'U123ABC', content: 'new memory', mode: 'NEW' },
                  { slackId: 'U123ABC', content: 'reinforce memory', mode: 'REINFORCE', existingMemoryId: 10 },
                  { slackId: 'U123ABC', content: 'evolved memory', mode: 'EVOLVE', existingMemoryId: 11 },
                ]),
              },
            ],
          },
        ],
      });

      await (aiService as unknown as AiServicePrivate).extractMemories('T1', 'C1', 'history', ['U123ABC']);

      expect(aiService.memoryPersistenceService.saveMemories).toHaveBeenCalled();
      expect(aiService.memoryPersistenceService.reinforceMemory).toHaveBeenCalledWith(10);
      expect(aiService.memoryPersistenceService.deleteMemory).toHaveBeenCalledWith(11);
    });

    it('extractMemories skips malformed extraction items', async () => {
      (aiService.redis.getExtractionLock as jest.Mock).mockResolvedValue(null);
      const warnSpy = jest.spyOn(aiService.aiServiceLogger, 'warn');
      (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify([
                  { mode: 'NEW' },
                  { slackId: 'invalid', content: 'x', mode: 'NEW' },
                  { slackId: 'U123ABC', content: 'x', mode: 'UNKNOWN' },
                ]),
              },
            ],
          },
        ],
      });

      await (aiService as unknown as AiServicePrivate).extractMemories('T1', 'C1', 'history', ['U123ABC']);

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('extractMemoriesForChannel', () => {
    it('returns early when there are no messages in the last 24 hours', async () => {
      (aiService.historyService.getLast24HoursForChannel as jest.Mock).mockResolvedValue([]);

      await aiService.extractMemoriesForChannel('T1', 'C1');

      expect(aiService.openAi.responses.create).not.toHaveBeenCalled();
    });

    it('returns early when there are no non-Moonbeam participants', async () => {
      (aiService.historyService.getLast24HoursForChannel as jest.Mock).mockResolvedValue([
        { slackId: MOONBEAM_SLACK_ID, name: 'Moonbeam', message: 'Hello there' },
      ]);

      await aiService.extractMemoriesForChannel('T1', 'C1');

      expect(aiService.openAi.responses.create).not.toHaveBeenCalled();
    });

    it('calls extractMemories with formatted history when valid messages exist', async () => {
      (aiService.historyService.getLast24HoursForChannel as jest.Mock).mockResolvedValue([
        { slackId: 'U1', name: 'Alice', message: 'Hello' },
        { slackId: MOONBEAM_SLACK_ID, name: 'Moonbeam', message: 'Hi Alice' },
      ]);
      (aiService.redis.getExtractionLock as jest.Mock).mockResolvedValue('1');

      await aiService.extractMemoriesForChannel('T1', 'C1');

      expect(aiService.historyService.getLast24HoursForChannel).toHaveBeenCalledWith('T1', 'C1');
    });

    it('propagates errors from getLast24HoursForChannel', async () => {
      (aiService.historyService.getLast24HoursForChannel as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(aiService.extractMemoriesForChannel('T1', 'C1')).rejects.toThrow('DB error');
    });
  });

  describe('send helpers', () => {
    it('sendImage posts image block and fallback on slack error', async () => {
      const sendMock = aiService.webService.sendMessage as jest.Mock;
      sendMock.mockRejectedValueOnce(new Error('slack fail')).mockResolvedValueOnce({ ok: true });

      aiService.sendImage('https://img', 'U1', 'T1', 'C1', 'draw cat');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendMock).toHaveBeenCalled();
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });

    it('sendGptText posts markdown and fallback on slack error', async () => {
      const sendMock = aiService.webService.sendMessage as jest.Mock;
      sendMock.mockRejectedValueOnce(new Error('slack fail')).mockResolvedValueOnce({ ok: true });

      aiService.sendGptText('hello world', 'U1', 'T1', 'C1', 'query');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendMock).toHaveBeenCalled();
      expect(aiService.redis.decrementDailyRequests).toHaveBeenCalledWith('U1', 'T1');
    });
  });
});
