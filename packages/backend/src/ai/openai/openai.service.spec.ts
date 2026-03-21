import { OpenAIService } from './openai.service';
import OpenAI from 'openai';

// Mock the OpenAI module
jest.mock('openai');

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    // Create a mock OpenAI instance
    mockOpenAI = {
      responses: {
        create: jest.fn(),
      },
      images: {
        generate: jest.fn(),
      },
    } as never;

    // Mock the OpenAI constructor to return our mock
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    service = new OpenAIService();
    jest.clearAllMocks();
  });

  describe('generateText', () => {
    it('should call OpenAI responses.create with correct parameters', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello **world**!' }],
          },
        ],
      };
      (mockOpenAI.responses.create as jest.Mock).mockResolvedValue(mockResponse);

      await service.generateText('Say hello', 'user123', 'Be friendly');

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: expect.any(String), // GPT_MODEL constant
        tools: [{ type: 'web_search_preview' }],
        instructions: 'Be friendly',
        input: 'Say hello',
        user: 'user123-DaBros2016',
      });
    });

    it('should return raw text when output_text is found', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello **world**! This is *italic*.' }],
          },
        ],
      };
      (mockOpenAI.responses.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateText('Say hello', 'user123');

      expect(result).toBe('Hello **world**! This is *italic*.');
    });

    it('should return undefined when no output_text is found', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_refusal', text: 'Cannot provide this content' }],
          },
        ],
      };
      (mockOpenAI.responses.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateText('Say hello', 'user123');

      expect(result).toBeUndefined();
    });

    it('should handle empty response gracefully', async () => {
      const mockResponse = { output: [] };
      (mockOpenAI.responses.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateText('Say hello', 'user123');

      expect(result).toBeUndefined();
    });

    it('should trim whitespace from output text', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '  Hello world!  ' }],
          },
        ],
      };
      (mockOpenAI.responses.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateText('Say hello', 'user123');

      expect(result).toBe('Hello world!');
    });
  });

  describe('generateImage', () => {
    it('should call OpenAI images.generate with correct parameters', async () => {
      const mockResponse = {
        data: [{ b64_json: 'base64imagestring' }],
      };
      (mockOpenAI.images.generate as jest.Mock).mockResolvedValue(mockResponse);

      await service.generateImage('A cat', 'user123');

      expect(mockOpenAI.images.generate).toHaveBeenCalledWith({
        model: expect.any(String), // GPT_IMAGE_MODEL constant
        prompt: 'A cat',
        user: 'user123-DaBros2016',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      });
    });

    it('should return b64_json when image is generated successfully', async () => {
      const mockResponse = {
        data: [{ b64_json: 'base64imagestring' }],
      };
      (mockOpenAI.images.generate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateImage('A cat', 'user123');

      expect(result).toBe('base64imagestring');
    });

    it('should return undefined when no data is returned', async () => {
      const mockResponse = { data: [] };
      (mockOpenAI.images.generate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateImage('A cat', 'user123');

      expect(result).toBeUndefined();
    });

    it('should return undefined when data is null/undefined', async () => {
      const mockResponse = { data: null };
      (mockOpenAI.images.generate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateImage('A cat', 'user123');

      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors in generateText', async () => {
      mockOpenAI.responses.create.mockRejectedValue(new Error('API Error'));

      await expect(service.generateText('test', 'user123')).rejects.toThrow('API Error');
    });

    it('should handle OpenAI API errors in generateImage', async () => {
      mockOpenAI.images.generate.mockRejectedValue(new Error('Image API Error'));

      await expect(service.generateImage('test', 'user123')).rejects.toThrow('Image API Error');
    });
  });
});
