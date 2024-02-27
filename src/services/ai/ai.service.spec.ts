import OpenAI from 'openai';
import { AIPersistenceService } from './ai.persistence';
import { AIService } from './ai.service';
import { MAX_AI_REQUESTS_PER_DAY } from './ai.constants';
import { MessageWithName } from '../../shared/models/message/message-with-name';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    const mockPersistence = {
      decrementDailyRequests: jest.fn(),
      getInflight: jest.fn(),
      getDailyRequests: jest.fn(),
      getHasUsedSummary: jest.fn(),
      removeInflight: jest.fn(),
      setInflight: jest.fn(),
      setDailyRequests: jest.fn(),
      setHasUsedSummary: jest.fn(),
      removeHasUsedSummary: jest.fn(),
    } as unknown as AIPersistenceService;

    const mockOpenAi = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      images: {
        generate: jest.fn(),
      },
    } as unknown as OpenAI;

    service = new AIService(mockPersistence, mockOpenAi);
  });

  describe('convertAsterisks', () => {
    it('should return undefined if text is undefined', () => {
      expect(service.convertAsterisks(undefined)).toBeUndefined();
    });

    it('should replace ** with *', () => {
      expect(service.convertAsterisks('**')).toBe('*');
      expect(service.convertAsterisks('****')).toBe('**');
      expect(service.convertAsterisks('**test**')).toBe('*test*');
    });
  });

  describe('decrementDaiyRequests', () => {
    it('should call decrementDailyRequests on aiPersistence', () => {
      const spy = jest.spyOn(service.persistence, 'decrementDailyRequests').mockResolvedValue('test');
      service.decrementDaiyRequests('userId', 'teamId');
      expect(spy).toHaveBeenCalledWith('userId', 'teamId');
    });
  });

  describe('isAlreadyInflight', () => {
    it('should call getInflight on aiPersistence', async () => {
      const spy = jest.spyOn(service.persistence, 'getInflight').mockResolvedValue('test');
      await service.isAlreadyInflight('userId', 'teamId');
      expect(spy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should return true if getInflight returns a value', async () => {
      jest.spyOn(service.persistence, 'getInflight').mockResolvedValue('test');
      expect(await service.isAlreadyInflight('userId', 'teamId')).toBe(true);
    });

    it('should return false if getInflight returns null', async () => {
      jest.spyOn(service.persistence, 'getInflight').mockResolvedValue(null);
      expect(await service.isAlreadyInflight('userId', 'teamId')).toBe(false);
    });
  });

  describe('isAlreadyAtMaxRequests', () => {
    it('should call getDailyRequests on aiPersistence', () => {
      const spy = jest
        .spyOn(service.persistence, 'getDailyRequests')
        .mockResolvedValue(MAX_AI_REQUESTS_PER_DAY.toString());
      service.isAlreadyAtMaxRequests('userId', 'teamId');
      expect(spy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should return true if getDailyRequests returns a value greater than or equal to MAX_AI_REQUESTS_PER_DAY', async () => {
      jest.spyOn(service.persistence, 'getDailyRequests').mockResolvedValue(MAX_AI_REQUESTS_PER_DAY.toString());
      expect(await service.isAlreadyAtMaxRequests('userId', 'teamId')).toBe(true);
    });

    it('should return false if getDailyRequests returns a value less than 10', async () => {
      jest.spyOn(service.persistence, 'getDailyRequests').mockResolvedValue('9');
      expect(await service.isAlreadyAtMaxRequests('userId', 'teamId')).toBe(false);
    });
  });

  describe('isAtMaxDailySummaries', () => {
    it('should call getHasUsedSummary on aiPersistence', () => {
      const spy = jest.spyOn(service.persistence, 'getHasUsedSummary').mockResolvedValue('true');
      service.isAtMaxDailySummaries('userId', 'teamId');
      expect(spy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should return true if getHasUsedSummary returns true', async () => {
      jest.spyOn(service.persistence, 'getHasUsedSummary').mockResolvedValue('true');
      expect(await service.isAtMaxDailySummaries('userId', 'teamId')).toBe(true);
    });

    it('should return false if getHasUsedSummary returns false', async () => {
      jest.spyOn(service.persistence, 'getHasUsedSummary').mockResolvedValue(null);
      expect(await service.isAtMaxDailySummaries('userId', 'teamId')).toBe(false);
    });
  });

  describe('generateText', () => {
    it('should call setInflight and setDailyRequests on aiPersistence when called', async () => {
      const setInflightSpy = jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      const setDailyRequestsSpy = jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      await service.generateText('userId', 'teamId', 'test');
      expect(setInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight and convertAsterisks if openai call is successful', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const convertAsterisksSpy = jest.spyOn(service, 'convertAsterisks').mockReturnValue('test');
      await service.generateText('userId', 'teamId', 'test');
      expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(convertAsterisksSpy).toHaveBeenCalledWith('test');
    });

    it('should call removeInflight, decrementDailyRequests and throw if openai call fails', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockRejectedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.generateText('userId', 'teamId', 'test');
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });
  });

  describe('generateImage', () => {
    it('should call setInflight and setDailyRequests on aiPersistence when called', async () => {
      const setInflightSpy = jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      const setDailyRequestsSpy = jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.images, 'generate').mockResolvedValue({
        data: [{ b64_json: 'test' }],
      } as OpenAI.Images.ImagesResponse);
      jest.spyOn(service, 'writeToDiskAndReturnUrl').mockResolvedValue('test');
      await service.generateImage('userId', 'teamId', 'test');
      expect(setInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight and writeToDiskAndReturnUrl if openai call is successful', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.images, 'generate').mockResolvedValue({
        data: [{ b64_json: 'test' }],
      } as OpenAI.Images.ImagesResponse);
      const writeToDiskSpy = jest.spyOn(service, 'writeToDiskAndReturnUrl').mockResolvedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      await service.generateImage('userId', 'teamId', 'test');
      expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(writeToDiskSpy).toHaveBeenCalledWith('test');
    });

    it('should call removeInflight, decrementDailyRequests and throw if openai call fails', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.images, 'generate').mockRejectedValue('test');
      jest.spyOn(service, 'writeToDiskAndReturnUrl').mockResolvedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.generateImage('userId', 'teamId', 'test');
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });

    it('should throw if no b64_json is returned by openai', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.images, 'generate').mockResolvedValue({
        data: [{}],
      } as OpenAI.Images.ImagesResponse);
      jest.spyOn(service, 'writeToDiskAndReturnUrl').mockResolvedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.generateImage('userId', 'teamId', 'test');
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });

    it('should throw if writeToDiskAndReturnUrl throws', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.images, 'generate').mockResolvedValue({
        data: [{ b64_json: 'test' }],
      } as OpenAI.Images.ImagesResponse);
      jest.spyOn(service, 'writeToDiskAndReturnUrl').mockRejectedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.generateImage('userId', 'teamId', 'test');
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });
  });

  describe('formatHistory', () => {
    it('should return a string of messages separated by newlines', () => {
      const history = [
        { name: 'test', message: 'test' },
        { name: 'test', message: 'test' },
      ];
      expect(service.formatHistory(history as MessageWithName[])).toBe('test: test\ntest: test');
    });
  });

  describe('getSummary - isDaily = false', () => {
    it('should call setInflight and setDailyRequests on aiPersistence when called', async () => {
      const setInflightSpy = jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      const setDailyRequestsSpy = jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      await service.getSummary('userId', 'teamId', 'test', false);
      expect(setInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight and convertAsterisks if openai call is successful', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const convertAsterisksSpy = jest.spyOn(service, 'convertAsterisks').mockReturnValue('test');
      await service.getSummary('userId', 'teamId', 'test', false);
      expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(convertAsterisksSpy).toHaveBeenCalledWith('test');
    });

    it('should call removeInflight, decrementDailyRequests and throw if openai call fails', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockRejectedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.getSummary('userId', 'teamId', 'test', false);
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });
  });

  describe('getSummary - isDaily = true', () => {
    it('should call setInflight and setDailyRequests on aiPersistence when called', async () => {
      const setInflightSpy = jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      const setDailyRequestsSpy = jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      await service.getSummary('userId', 'teamId', 'test', true);
      expect(setInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(setDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight and setHasUsedSummary if openai call is successful', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const setHasUsedSummarySpy = jest.spyOn(service.persistence, 'setHasUsedSummary').mockResolvedValue('test');
      await service.getSummary('userId', 'teamId', 'test', true);
      expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(setHasUsedSummarySpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight, removeHasUsedSummary, decrementDailyRequests and throw if openai call fails', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.persistence, 'setDailyRequests').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockRejectedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const removeHasUsedSummary = jest.spyOn(service.persistence, 'removeHasUsedSummary').mockResolvedValue('test');
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.getSummary('userId', 'teamId', 'test', true);
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(removeHasUsedSummary).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });
  });

  describe('promptWithHistory', () => {
    it('should call setInflight on aiPersistence when called', async () => {
      const setInflightSpy = jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      await service.promptWithHistory('userId', 'teamId', 'test', 'test');
      expect(setInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
    });

    it('should call removeInflight and convertAsterisks if openai call is successful', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockResolvedValue({
        choices: [{ message: { content: 'test' } }],
      } as OpenAI.Chat.Completions.ChatCompletion);
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const convertAsterisksSpy = jest.spyOn(service, 'convertAsterisks').mockReturnValue('test');
      await service.promptWithHistory('userId', 'teamId', 'test', 'test');
      expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
      expect(convertAsterisksSpy).toHaveBeenCalledWith('test');
    });

    it('should call removeInflight, decrementDailyRequests and throw if openai call fails', async () => {
      jest.spyOn(service.persistence, 'setInflight').mockResolvedValue('test');
      jest.spyOn(service.openai.chat.completions, 'create').mockRejectedValue('test');
      const removeInflightSpy = jest.spyOn(service.persistence, 'removeInflight').mockResolvedValue(1);
      const decrementDailyRequestsSpy = jest
        .spyOn(service.persistence, 'decrementDailyRequests')
        .mockResolvedValue('test');
      try {
        await service.promptWithHistory('userId', 'teamId', 'test', 'test');
      } catch (e) {
        expect(removeInflightSpy).toHaveBeenCalledWith('userId', 'teamId');
        expect(decrementDailyRequestsSpy).toHaveBeenCalledWith('userId', 'teamId');
      }
    });
  });
});
