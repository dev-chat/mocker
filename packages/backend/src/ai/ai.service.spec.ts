import { AIService } from './ai.service';
import { MessageWithName } from '../shared/models/message/message-with-name';
import { MOONBEAM_SLACK_ID } from './ai.constants';

const buildAiService = (): AIService => {
  const ai = new AIService();

  ai.redis = {
    setInflight: jest.fn().mockResolvedValue('OK'),
    setDailyRequests: jest.fn().mockResolvedValue('OK'),
    removeInflight: jest.fn().mockResolvedValue(1),
    decrementDailyRequests: jest.fn().mockResolvedValue('0'),
    setParticipationInFlight: jest.fn().mockResolvedValue('OK'),
    removeParticipationInFlight: jest.fn().mockResolvedValue(1),
    setHasParticipated: jest.fn().mockResolvedValue('OK'),
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
  } as unknown as AIService['memoryPersistenceService'];

  ai.historyService = {
    getHistory: jest.fn().mockResolvedValue([]),
    getHistoryWithOptions: jest.fn().mockResolvedValue([]),
  } as unknown as AIService['historyService'];

  ai.webService = {
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as AIService['webService'];

  ai.slackService = {
    containsTag: jest.fn(),
    isUserMentioned: jest.fn(),
  } as unknown as AIService['slackService'];

  ai.muzzlePersistenceService = {
    isUserMuzzled: jest.fn().mockResolvedValue(false),
  } as unknown as AIService['muzzlePersistenceService'];

  ai.aiServiceLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
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
      expect(createSpy).toHaveBeenCalled();
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

      const diskSpy = jest.spyOn(aiService, 'writeToDiskAndReturnUrl').mockResolvedValue('https://muzzle.lol/image.png');
      const sendSpy = jest.spyOn(aiService, 'sendImage').mockImplementation();

      await aiService.generateImage('U1', 'T1', 'C1', 'draw cat');

      expect(generateContentSpy).toHaveBeenCalled();
      expect(diskSpy).toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith('https://muzzle.lol/image.png', 'U1', 'T1', 'C1', 'draw cat');
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
      expect(aiService.openAi.responses.create).toHaveBeenCalled();
      expect(aiService.webService.sendMessage).toHaveBeenCalledWith('C1', 'Summarize', expect.any(Array));
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

      expect(participateSpy).toHaveBeenCalledWith('T1', 'C1', `<@${MOONBEAM_SLACK_ID}> hello`);
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
  });
});
