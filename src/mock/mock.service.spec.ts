import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { MockService } from './mock.service';

describe('MockService', () => {
  let mockService: MockService;
  beforeEach(() => {
    mockService = new MockService();
  });
  describe('mock()', () => {
    it('should mock a users input (single word)', () => {
      const messageSpy = jest.spyOn(mockService.slackService, 'sendResponse').mockImplementation(() => {});
      mockService.mock({ text: 'test', user_id: 'U12345', response_url: 'http://response.url' } as SlashCommandRequest);
      expect(messageSpy).toHaveBeenCalledWith('http://response.url', {
        attachments: [
          {
            text: 'tEsT',
          },
        ],
        response_type: 'in_channel',
        text: '<@U12345>',
      });
    });

    it('should mock a users input (sentence)', () => {
      const messageSpy = jest.spyOn(mockService.slackService, 'sendResponse').mockImplementation(() => {});
      mockService.mock({
        text: 'test this out',
        user_id: 'U12345',
        response_url: 'http://response.url',
      } as SlashCommandRequest);
      expect(messageSpy).toHaveBeenCalledWith('http://response.url', {
        attachments: [
          {
            text: 'tEsT tHiS oUt',
          },
        ],
        response_type: 'in_channel',
        text: '<@U12345>',
      });
    });

    it('should do nothing if request.text is an empty string', () => {
      const messageSpy = jest.spyOn(mockService.slackService, 'sendResponse').mockImplementation(() => {});
      mockService.mock({ text: '', user_id: 'U12345', response_url: 'http://response.url' } as SlashCommandRequest);
      expect(messageSpy).not.toHaveBeenCalled();
    });
  });
});
