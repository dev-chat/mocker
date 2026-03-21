import { Definition } from '../shared/models/define/define-models';
import { DefineService } from './define.service';
import * as axios from 'axios';

jest.mock('axios');
jest.mock('../shared/services/web/web.service', () => ({
  WebService: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
  })),
}));

const testArray: Definition[] = [
  {
    definition: 'one',
    permalink: 'https://urbandictionary.com/whatever',
    thumbs_up: 12,
    author: 'jr',
    word: 'test',
    defid: 1,
    written_on: 'whatever', // ISO Date
    example: 'test',
    thumbs_down: 14,
    current_vote: 'test',
    sound_urls: ['test'],
  },
  {
    definition: 'two',
    permalink: 'https://urbandictionary.com/whatever',
    thumbs_up: 12,
    author: 'jr',
    word: 'test',
    defid: 1,
    written_on: 'whatever', // ISO Date
    example: 'test',
    thumbs_down: 14,
    current_vote: 'test',
    sound_urls: ['test'],
  },
  {
    definition: 'three',
    permalink: 'https://urbandictionary.com/whatever',
    thumbs_up: 12,
    author: 'jr',
    word: 'test',
    defid: 1,
    written_on: 'whatever', // ISO Date
    example: 'test',
    thumbs_down: 14,
    current_vote: 'test',
    sound_urls: ['test'],
  },
  {
    definition: 'four',
    permalink: 'https://urbandictionary.com/whatever',
    thumbs_up: 12,
    author: 'jr',
    word: 'test',
    defid: 1,
    written_on: 'whatever', // ISO Date
    example: 'test',
    thumbs_down: 14,
    current_vote: 'test',
    sound_urls: ['test'],
  },
  {
    definition: 'five',
    permalink: 'https://urbandictionary.com/whatever',
    thumbs_up: 12,
    author: 'jr',
    word: 'test',
    defid: 1,
    written_on: 'whatever', // ISO Date
    example: 'five',
    thumbs_down: 14,
    current_vote: 'test',
    sound_urls: ['test'],
  },
];

describe('DefineService', () => {
  let defineService: DefineService;
  let mockWebService: { sendMessage: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    defineService = new DefineService();
    mockWebService = defineService.webService;
  });

  describe('capitalizeFirstLetter()', () => {
    it('should capitalize all first letters of a given string', () => {
      expect(defineService.capitalizeFirstLetter('test string')).toBe('Test String');
    });

    it('should capitalize only the first letter of the first word when all = false', () => {
      expect(defineService.capitalizeFirstLetter('test string', false)).toBe('Test string');
    });

    it('should handle empty string', () => {
      expect(defineService.capitalizeFirstLetter('')).toBe('');
    });

    it('should handle single character', () => {
      expect(defineService.capitalizeFirstLetter('a')).toBe('A');
    });

    it('should handle already capitalized string', () => {
      expect(defineService.capitalizeFirstLetter('Test String')).toBe('Test String');
    });

    it('should handle string with multiple spaces', () => {
      expect(defineService.capitalizeFirstLetter('hello   world')).toContain('Hello');
      expect(defineService.capitalizeFirstLetter('hello   world')).toContain('World');
    });
  });

  describe('define()', () => {
    it('should fetch definition and send formatted message to Slack', async () => {
      const mockData = {
        list: testArray.slice(0, 3),
      };
      (axios.default.get as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      await defineService.define('test', 'U123', 'C123');

      expect(axios.default.get).toHaveBeenCalledWith(expect.stringContaining('urbandictionary.com'));
      expect(mockWebService.sendMessage).toHaveBeenCalledWith('C123', expect.any(String), expect.any(Array));
    });

    it('should format word with spaces correctly', async () => {
      const mockData = { list: [] };
      (axios.default.get as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      await defineService.define('multi word phrase', 'U123', 'C123');

      expect(axios.default.get).toHaveBeenCalledWith(expect.stringContaining('multi+word+phrase'));
    });

    it('should handle API errors gracefully', async () => {
      (axios.default.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(defineService.define('test', 'U123', 'C123')).rejects.toThrow('Network error');
    });

    it('should handle empty definitions list', async () => {
      const mockData = { list: [] };
      (axios.default.get as jest.Mock).mockResolvedValue({
        data: mockData,
      });

      await defineService.define('test', 'U123', 'C123');

      const blocks = (mockWebService.sendMessage as jest.Mock).mock.calls[0][2];
      expect(blocks).toContainEqual(
        expect.objectContaining({
          text: expect.objectContaining({
            text: expect.stringContaining('Sorry, no definitions'),
          }),
        }),
      );
    });

    it('should handle webService.sendMessage errors', async () => {
      const mockData = { list: testArray.slice(0, 1) };
      (axios.default.get as jest.Mock).mockResolvedValue({
        data: mockData,
      });
      mockWebService.sendMessage.mockRejectedValue(new Error('Slack error'));

      await defineService.define('test', 'U123', 'C123');

      expect(mockWebService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('formatDefs()', () => {
    it('should return an array of 3 length when no maxDefs parameter is provided', () => {
      expect(defineService.formatDefs(testArray, 'test').length).toBe(3);
    });

    it('should return an array of 4 length when a maxDefs parameter of 4 is provided', () => {
      expect(defineService.formatDefs(testArray, 'test', 4).length).toBe(4);
    });

    it('should return testArray.length if maxDefs parameter is larger than testArray.length', () => {
      expect(defineService.formatDefs(testArray, 'test', 10).length).toBe(5);
    });

    it(`should return [{ "Sorry, no definitions found" }] if defArr === 0`, () => {
      expect(defineService.formatDefs([], 'test')[0].text).toEqual({
        text: '> Sorry, no definitions found.',
        type: 'mrkdwn',
      });
    });

    it('should handle null defArr', () => {
      const result = defineService.formatDefs(null as unknown as Definition[], 'test');
      expect(result[0].text).toEqual({
        text: '> Sorry, no definitions found.',
        type: 'mrkdwn',
      });
    });

    it('should filter definitions by word matching', () => {
      const mixedArray: Definition[] = [
        ...testArray,
        {
          definition: 'different word',
          word: 'other',
          permalink: 'https://urbandictionary.com/whatever',
          thumbs_up: 12,
          author: 'jr',
          defid: 1,
          written_on: 'whatever',
          example: 'test',
          thumbs_down: 14,
          current_vote: 'test',
          sound_urls: ['test'],
        },
      ];

      const result = defineService.formatDefs(mixedArray, 'test', 10);
      expect(result.length).toBe(5);
    });

    it('should handle case insensitive word matching', () => {
      const result = defineService.formatDefs(testArray, 'TEST', 10);
      expect(result.length).toBe(5);
    });

    it('should clean up definition text formatting', () => {
      const defWithFormatting: Definition[] = [
        {
          definition: 'test [definition] with\r\ncarriage returns\n\nand newlines',
          word: 'test',
          permalink: 'https://urbandictionary.com/whatever',
          thumbs_up: 12,
          author: 'jr',
          defid: 1,
          written_on: 'whatever',
          example: 'test',
          thumbs_down: 14,
          current_vote: 'test',
          sound_urls: ['test'],
        },
      ];

      const result = defineService.formatDefs(defWithFormatting, 'test');
      expect(result[0].text.text).not.toContain('[');
      expect(result[0].text.text).not.toContain(']');
    });

    it('should return no definitions found if no matching words', () => {
      const result = defineService.formatDefs(testArray, 'nonexistent');
      expect(result[0].text).toEqual({
        text: '> Sorry, no definitions found.',
        type: 'mrkdwn',
      });
    });

    it('should include context block in message', () => {
      const result = defineService.formatDefs(testArray, 'test', 1);
      expect(result.length).toBe(1);
    });

    it('should format blocks correctly', () => {
      const result = defineService.formatDefs(testArray, 'test', 1);
      expect(result[0]).toHaveProperty('type', 'section');
      expect(result[0]).toHaveProperty('text');
    });
  });
});
