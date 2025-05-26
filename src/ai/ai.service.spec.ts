import { mockAiPersistenceService } from './mocks/mocks';
import { MAX_AI_REQUESTS_PER_DAY } from './ai.constants';
import { AIService } from './ai.service';
import { Logger } from 'winston';

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
