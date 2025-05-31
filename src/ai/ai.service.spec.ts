import { mockAiPersistenceService } from './mocks/mocks';
import { MAX_AI_REQUESTS_PER_DAY } from './ai.constants';
import { AIService } from './ai.service';
import { Logger } from 'winston';
import { MessageWithName } from '../shared/models/message/message-with-name';
import { Event, EventRequest, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { WebAPICallResult } from '@slack/web-api';

jest.mock('./openai/openai.service', () => ({
  OpenAIService: jest.fn().mockImplementation(() => ({
    generateText: jest.fn(),
    generateImage: jest.fn(),
    convertAsterisks: jest.fn(),
  })),
}));
jest.mock('./ai.persistence', () => mockAiPersistenceService);
jest.mock('../shared/services/history.persistence.service');
jest.mock('../shared/services/web/web.service');
jest.mock('../shared/logger/logger');

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
    aiService.aiServiceLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;
  });

  describe('decrementDaiyRequests', () => {
    it('should call decrementDailyRequests on the persistence service', async () => {
      const decrementMock = jest.spyOn(aiService.redis, 'decrementDailyRequests').mockResolvedValue('5');

      const result = await aiService.decrementDaiyRequests('user123', 'team123');

      expect(decrementMock).toHaveBeenCalledWith('user123', 'team123');
      expect(result).toBe('5');
    });
  });

  describe('isAlreadyInflight', () => {
    it('should return true if there is an inflight request', async () => {
      const getInFlightMock = jest.spyOn(aiService.redis, 'getInflight').mockResolvedValue('true');
      const result = await aiService.isAlreadyInflight('user123', 'team123');
      expect(result).toBe(true);
      expect(getInFlightMock).toHaveBeenCalledWith('user123', 'team123');
    });

    it('should return false if there is no inflight request', async () => {
      const getInFlightMock = jest.spyOn(aiService.redis, 'getInflight').mockResolvedValue(null);
      const result = await aiService.isAlreadyInflight('user123', 'team123');
      expect(result).toBe(false);
      expect(getInFlightMock).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('isAlreadyAtMaxRequests', () => {
    it('should return true if the user has reached the max requests', async () => {
      const dailyRequestsMock = jest
        .spyOn(aiService.redis, 'getDailyRequests')
        .mockResolvedValue(MAX_AI_REQUESTS_PER_DAY.toString());
      const result = await aiService.isAlreadyAtMaxRequests('user123', 'team123');
      expect(result).toBe(true);
      expect(dailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
    });

    it('should return false if the user has not reached the max requests', async () => {
      const dailyRequestsMock = jest
        .spyOn(aiService.redis, 'getDailyRequests')
        .mockResolvedValue((MAX_AI_REQUESTS_PER_DAY - 1).toString());
      const result = await aiService.isAlreadyAtMaxRequests('user123', 'team123');
      expect(result).toBe(false);
      expect(dailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('generateText', () => {
    it('should set inflight, generate text, and send message', async () => {
      const setInflightMock = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsMock = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const generateTextMock = jest.spyOn(aiService.openAiService, 'generateText').mockResolvedValue('Generated text');
      const sendGptTextMock = jest.spyOn(aiService, 'sendGptText').mockImplementation();

      await aiService.generateText('user123', 'team123', 'channel123', 'Hello AI');

      expect(setInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(generateTextMock).toHaveBeenCalledWith('Hello AI', 'user123', expect.any(String));
      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(sendGptTextMock).toHaveBeenCalledWith('Generated text', 'user123', 'team123', 'channel123', 'Hello AI');
    });

    it('should handle errors and clean up inflight status', async () => {
      jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const decrementMock = jest.spyOn(aiService.redis, 'decrementDailyRequests').mockResolvedValue('4');
      jest.spyOn(aiService.openAiService, 'generateText').mockRejectedValue(new Error('API Error'));

      await expect(aiService.generateText('user123', 'team123', 'channel123', 'Hello AI')).rejects.toThrow('API Error');

      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(decrementMock).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('generateImage', () => {
    it('should generate image and send to channel', async () => {
      const setInflightMock = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsMock = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const generateImageMock = jest.spyOn(aiService.openAiService, 'generateImage').mockResolvedValue('base64data');
      const writeToDiskMock = jest
        .spyOn(aiService, 'writeToDiskAndReturnUrl')
        .mockResolvedValue('https://muzzle.lol/image.png');
      const sendImageMock = jest.spyOn(aiService, 'sendImage').mockImplementation();

      await aiService.generateImage('user123', 'team123', 'channel123', 'Draw a cat');

      expect(setInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(generateImageMock).toHaveBeenCalledWith('Draw a cat', 'user123');
      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(writeToDiskMock).toHaveBeenCalledWith('base64data');
      expect(sendImageMock).toHaveBeenCalledWith(
        'https://muzzle.lol/image.png',
        'user123',
        'team123',
        'channel123',
        'Draw a cat',
      );
    });

    it('should throw error if no image data returned', async () => {
      jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      jest.spyOn(aiService.openAiService, 'generateImage').mockResolvedValue(undefined);

      await expect(aiService.generateImage('user123', 'team123', 'channel123', 'Draw a cat')).rejects.toThrow(
        'No b64_json was returned by OpenAI',
      );

      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('generateCorpoSpeak', () => {
    it('should generate corpo speak text', async () => {
      const generateTextMock = jest.spyOn(aiService.openAiService, 'generateText').mockResolvedValue('Corporate text');

      const result = await aiService.generateCorpoSpeak('Make this corporate');

      expect(generateTextMock).toHaveBeenCalledWith('Make this corporate', 'Moonbeam', expect.any(String));
      expect(result).toBe('Corporate text');
    });

    it('should handle errors in generation', async () => {
      jest.spyOn(aiService.openAiService, 'generateText').mockRejectedValue(new Error('Generation failed'));

      await expect(aiService.generateCorpoSpeak('Make this corporate')).rejects.toThrow('Generation failed');
    });
  });

  describe('formatHistory', () => {
    it('should format message history correctly', () => {
      const history: MessageWithName[] = [
        { name: 'John', message: 'Hello there' },
        { name: 'Jane', message: 'How are you?' },
        { name: 'Bob', message: 'Good morning!' },
      ] as MessageWithName[];

      const result = aiService.formatHistory(history);

      expect(result).toBe('John: Hello there\nJane: How are you?\nBob: Good morning!');
    });

    it('should handle empty history', () => {
      const result = aiService.formatHistory([]);
      expect(result).toBe('');
    });
  });

  describe('promptWithHistory', () => {
    it('should generate text with history context', async () => {
      const history: MessageWithName[] = [
        { name: 'John', message: 'Hello' },
        { name: 'Jane', message: 'Hi' },
      ] as MessageWithName[];
      const setInflightMock = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsMock = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const generateTextMock = jest
        .spyOn(aiService.openAiService, 'generateText')
        .mockResolvedValue('Response with context');
      const getHistoryMock = jest.spyOn(aiService.historyService, 'getHistory').mockResolvedValue(history);
      const sendMessageMock = jest
        .spyOn(aiService.webService, 'sendMessage')
        .mockImplementation(() => Promise.resolve({} as WebAPICallResult));

      await aiService.promptWithHistory({
        user_id: 'user123',
        team_id: 'team123',
        channel_id: 'channel123',
        text: 'Prompt',
      } as SlashCommandRequest);

      expect(setInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(generateTextMock).toHaveBeenCalledWith(
        'Prompt',
        'user123',
        `Use this conversation history to respond to the user's prompt:\nJohn: Hello\nJane: Hi`,
      );
      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(getHistoryMock).toHaveBeenCalledWith(
        { team_id: 'team123', text: 'Prompt', user_id: 'user123', channel_id: 'channel123' },
        true,
      );
      expect(sendMessageMock).toHaveBeenCalledWith('channel123', 'Prompt', [
        { text: { text: 'Response with context', type: 'mrkdwn' }, type: 'section' },
        { type: 'divider' },
        {
          elements: [
            {
              text: ':technologist: _Context-aware prompt generated by <@user123> | "Prompt"_ :technologist:',
              type: 'mrkdwn',
            },
          ],
          type: 'context',
        },
      ]);
    });
  });

  describe('participate', () => {
    it('should participate in conversation with recent history', async () => {
      const getHistoryMock = jest
        .spyOn(aiService.historyService, 'getHistory')
        .mockResolvedValue([{ name: 'John', message: 'Hello' }] as MessageWithName[]);
      const getHasParticipatedMock = jest.spyOn(aiService.redis, 'getHasParticipated').mockResolvedValue(null);
      jest.spyOn(aiService.webService, 'sendMessage').mockImplementation(() => Promise.resolve({} as WebAPICallResult));
      const generateTextMock = jest
        .spyOn(aiService.openAiService, 'generateText')
        .mockResolvedValue('Participated response');

      await aiService.participate('team123', 'channel123', 'tagged message');

      expect(getHasParticipatedMock).toHaveBeenCalledWith('team123', 'channel123');
      expect(getHistoryMock).toHaveBeenCalledWith({ channel_id: 'channel123', team_id: 'team123' }, false);
      expect(generateTextMock).toHaveBeenCalledWith(
        'John: Hello',
        'Moonbeam',
        `
You are Moonbeam. Your purpose is to respond to this question: \"tagged message\" given the context of the chat you will receive in the following message.
You should focus on either being helpful, informative, or incredibly toxic in your responses.
The chat history is listed in chronological order.
In that chat history, messages you have sent are listed as muzzle3 saying them.
Do not try to impersonate another user in the chat.
Do not ever start your message in the format with \"Username:\".
Do not send more than one sentence.
Do not start your messages with your name. Simply start with the message.
Do not use capitalization or punctuation unless you are specifically trying to emphasze something.
`,
      );
    });
  });

  describe('sendGptText', () => {
    it('should send formatted text message to channel', () => {
      const sendMessageMock = jest
        .spyOn(aiService.webService, 'sendMessage')
        .mockImplementation(() => Promise.resolve({} as WebAPICallResult));

      aiService.sendGptText('Generated text', 'user123', 'team123', 'channel123', 'Original prompt');

      expect(sendMessageMock).toHaveBeenCalledWith('channel123', 'Generated text', expect.any(Array));
    });
  });

  describe('sendImage', () => {
    it('should send image message to channel', () => {
      const sendMessageMock = jest
        .spyOn(aiService.webService, 'sendMessage')
        .mockImplementation(() => Promise.resolve({} as WebAPICallResult));

      aiService.sendImage('https://muzzle.lol/image.png', 'user123', 'team123', 'channel123', 'Image Prompt');

      expect(sendMessageMock).toHaveBeenCalledWith('channel123', 'Image Prompt', [
        { alt_text: 'Image Prompt', image_url: 'https://muzzle.lol/image.png', type: 'image' },
        {
          elements: [
            {
              text: ':camera_with_flash: _Generated by <@user123> | "Image Prompt"_ :camera_with_flash:',
              type: 'mrkdwn',
            },
          ],
          type: 'context',
        },
      ]);
    });
  });

  describe('handle', () => {
    it('should handle', async () => {
      const request: EventRequest = {
        event: {
          type: 'slash_command',
          user: 'user123',
          text: 'Generate text',
          channel: 'channel123',
        } as Event,
        team_id: 'team123',
      } as EventRequest;

      const isInflightMock = jest.spyOn(aiService, 'isAlreadyInflight').mockResolvedValue(false);
      const isMaxRequestsMock = jest.spyOn(aiService, 'isAlreadyAtMaxRequests').mockResolvedValue(false);
      const generateTextMock = jest.spyOn(aiService, 'generateText').mockResolvedValue();

      await aiService.handle(request);

      expect(isInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(isMaxRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(generateTextMock).toHaveBeenCalledWith('user123', 'team123', 'channel123', 'Generate text');
    });

    it('should handle event request for muzzled user', async () => {
      const request: EventRequest = {
        event: {
          type: 'message',
          user: 'user123',
          text: 'Hello',
          channel: 'channel123',
        },
        team_id: 'team123',
      } as EventRequest;

      const isUserMuzzledMock = jest.spyOn(aiService.muzzlePersistenceService, 'isUserMuzzled').mockResolvedValue(true);
      const participateMock = jest.spyOn(aiService, 'participate').mockResolvedValue();

      await aiService.handle(request);

      expect(isUserMuzzledMock).toHaveBeenCalledWith('user123', 'team123');
      expect(participateMock).toHaveBeenCalledWith('user123', 'team123', 'channel123');
    });
  });

  describe('writeToDiskAndReturnUrl', () => {
    it('should write the image to disk and return the URL', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      const fsMock = jest.spyOn(require('fs'), 'writeFile').mockImplementation((_, __, ___, callback: any) => {
        callback(null);
      });
      const result = await aiService.writeToDiskAndReturnUrl('data:image/png;base64,base64data');
      expect(fsMock).toHaveBeenCalled();
      expect(result).toMatch(/https:\/\/muzzle\.lol\/.+\.png/);
    });

    it('should throw an error if writing to disk fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      jest.spyOn(require('fs'), 'writeFile').mockImplementation((_, __, ___, callback: any) => {
        callback(new Error('Disk error'));
      });
      await expect(aiService.writeToDiskAndReturnUrl('data:image/png;base64,base64data')).rejects.toThrow('Disk error');
    });
  });
});
