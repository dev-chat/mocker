import OpenAI from 'openai';
import { OpenAIMock } from '../shared/mocks/openai.mock';
import { mockAiPersistenceService } from './mocks/mocks';
import { GPT_MODEL, MAX_AI_REQUESTS_PER_DAY } from './ai.constants';
import { AIService } from './ai.service';
import { Logger } from 'winston';

jest.mock('openai', () => OpenAIMock);
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
    it('should call OpenAI and handle success', async () => {
      const setInflightMock = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsMock = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const openaiMock = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated text' } }],
            }),
          },
        },
      };
      aiService['openai'] = openaiMock as unknown as OpenAI;

      const sendGptTextSpy = jest.spyOn(aiService, 'sendGptText').mockImplementation();

      await aiService.generateText('user123', 'team123', 'channel123', 'Mock Query');

      expect(setInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith({
        model: GPT_MODEL,
        messages: [{ role: 'system', content: 'Mock Query be succinct' }],
        user: 'user123-DaBros2016',
      });
      expect(sendGptTextSpy).toHaveBeenCalledWith('Generated text', 'user123', 'team123', 'channel123', 'Mock Query');
    });

    it('should handle errors and clean up inflight requests', async () => {
      const setInflightMock = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsMock = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightMock = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const decrementDailyRequestsMock = jest.spyOn(aiService.redis, 'decrementDailyRequests').mockResolvedValue(null);
      const openaiMock = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI error')),
          },
        },
      };
      aiService['openai'] = openaiMock as unknown as OpenAI;

      await expect(aiService.generateText('user123', 'team123', 'channel123', 'Hello world')).rejects.toThrow(
        'OpenAI error',
      );

      expect(setInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
      expect(removeInflightMock).toHaveBeenCalledWith('user123', 'team123');
      expect(decrementDailyRequestsMock).toHaveBeenCalledWith('user123', 'team123');
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

  describe('generateImages', () => {
    it('should generate an image and send it successfully', async () => {
      const setInflightSpy = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsSpy = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightSpy = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const writeToDiskAndReturnUrlSpy = jest
        .spyOn(aiService, 'writeToDiskAndReturnUrl')
        .mockResolvedValue('https://example.com/image.png');
      const sendImageSpy = jest.spyOn(aiService, 'sendImage').mockImplementation();
      const openaiGenerateSpy = jest.spyOn(aiService.openai.images, 'generate').mockResolvedValue({
        data: [{ b64_json: 'base64data' }],
        created: 1234567890,
      });

      await aiService.generateImage('user123', 'team123', 'channel123', 'A beautiful sunset');

      expect(setInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(removeInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(openaiGenerateSpy).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A beautiful sunset',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        user: 'user123-DaBros2016',
      });
      expect(writeToDiskAndReturnUrlSpy).toHaveBeenCalledWith('base64data');
      expect(sendImageSpy).toHaveBeenCalledWith(
        'https://example.com/image.png',
        'user123',
        'team123',
        'channel123',
        'A beautiful sunset',
      );
    });

    it('should throw an error if no b64_json is returned', async () => {
      const setInflightSpy = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsSpy = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightSpy = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const openaiGenerateSpy = jest.spyOn(aiService.openai.images, 'generate').mockResolvedValue({
        data: [{}],
        created: 1234, // No b64_json
      });

      await expect(aiService.generateImage('user123', 'team123', 'channel123', 'A beautiful sunset')).rejects.toThrow(
        'No b64_json was returned by OpenAI for prompt: A beautiful sunset',
      );

      expect(setInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(removeInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(openaiGenerateSpy).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A beautiful sunset',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        user: 'user123-DaBros2016',
      });
    });

    it('should handle errors and clean up inflight requests', async () => {
      const setInflightSpy = jest.spyOn(aiService.redis, 'setInflight').mockResolvedValue('');
      const setDailyRequestsSpy = jest.spyOn(aiService.redis, 'setDailyRequests').mockResolvedValue('');
      const removeInflightSpy = jest.spyOn(aiService.redis, 'removeInflight').mockResolvedValue(0);
      const decrementDailyRequestsSpy = jest.spyOn(aiService.redis, 'decrementDailyRequests').mockResolvedValue(null);
      const openaiGenerateSpy = jest
        .spyOn(aiService.openai.images, 'generate')
        .mockRejectedValue(new Error('OpenAI error'));
      const loggerErrorSpy = jest.spyOn(aiService.aiServiceLogger, 'error').mockImplementation();

      await expect(aiService.generateImage('user123', 'team123', 'channel123', 'A beautiful sunset')).rejects.toThrow(
        'OpenAI error',
      );

      expect(setInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(removeInflightSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
      expect(openaiGenerateSpy).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A beautiful sunset',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        user: 'user123-DaBros2016',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(new Error('OpenAI error'));
    });
  });

  describe('convertAsterisks', () => {
    it('should return undefined if the input is undefined', () => {
      const result = aiService.convertAsterisks(undefined);
      expect(result).toBeUndefined();
    });

    it('should return the same string if there are no double asterisks', () => {
      const input = 'This is a test string with no double asterisks.';
      const result = aiService.convertAsterisks(input);
      expect(result).toBe(input);
    });

    it('should replace all occurrences of double asterisks with single asterisks', () => {
      const input = 'This **is** a **test** string.';
      const expectedOutput = 'This *is* a *test* string.';
      const result = aiService.convertAsterisks(input);
      expect(result).toBe(expectedOutput);
    });

    it('should handle strings with multiple consecutive double asterisks', () => {
      const input = 'This ****is**** a test.';
      const expectedOutput = 'This **is** a test.';
      const result = aiService.convertAsterisks(input);
      expect(result).toBe(expectedOutput);
    });

    it('should handle strings with only double asterisks', () => {
      const input = '****';
      const expectedOutput = '**';
      const result = aiService.convertAsterisks(input);
      expect(result).toBe(expectedOutput);
    });

    it('should handle strings with mixed single and double asterisks', () => {
      const input = '*This* **is** a *test* **string**.';
      const expectedOutput = '*This* *is* a *test* *string*.';
      const result = aiService.convertAsterisks(input);
      expect(result).toBe(expectedOutput);
    });
  });
});
