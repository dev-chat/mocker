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

    it('should return formatted text when output_text is found', async () => {
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

      expect(result).toBe('Hello *world*! This is _italic_.');
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

  describe('markdownToSlackMrkdwn', () => {
    it('should convert bold markdown to Slack format', () => {
      const input = 'This is **bold** text';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('This is *bold* text');
    });

    it('should convert italic markdown to Slack format', () => {
      const input = 'This is *italic* text';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('This is _italic_ text');
    });

    it('should preserve code blocks', () => {
      const input = 'This is `code` text';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('This is `code` text');
    });

    it('should convert links to Slack format', () => {
      const input = 'Check out [Google](https://google.com)';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('Check out <https://google.com|Google>');
    });

    it('should convert images to Slack format', () => {
      const input = 'Look at this ![cat](https://example.com/cat.jpg)';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('Look at this <https://example.com/cat.jpg|cat>');
    });

    it('should handle multiple formatting types in one string', () => {
      const input = 'This is **bold** and *italic* with `code` and [link](https://test.com)';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('This is *bold* and _italic_ with `code` and <https://test.com|link>');
    });

    it('should return undefined for undefined input', () => {
      const result = service.markdownToSlackMrkdwn(undefined);
      expect(result).toBeUndefined();
    });

    it('should return empty string for empty input', () => {
      const result = service.markdownToSlackMrkdwn('');
      expect(result).toBe('');
    });

    it('should handle text with no markdown', () => {
      const input = 'Just plain text';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('Just plain text');
    });

    it('should handle nested formatting correctly', () => {
      const input = 'This is **bold with *italic* inside**';
      const result = service.markdownToSlackMrkdwn(input);
      expect(result).toBe('This is *bold with _italic_ inside*');
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
