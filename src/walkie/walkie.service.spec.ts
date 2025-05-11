import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { WalkieService } from './walkie.service';

describe('slack-utils', () => {
  let walkieService: WalkieService;

  beforeEach(() => {
    walkieService = new WalkieService();
  });

  describe('getUserId()', () => {
    it('should return the user ID from a string', () => {
      const result = walkieService.getUserId('<@U12345>');
      expect(result).toBe('U12345');
    });

    it('should return an empty string if no user ID is found', () => {
      const result = walkieService.getUserId('John Doe');
      expect(result).toBe('');
    });

    it('should return an empty string if the input is null', () => {
      const result = walkieService.getUserId(null as unknown as string);
      expect(result).toBe('');
    });

    it('should return an empty string if the input is undefined', () => {
      const result = walkieService.getUserId(undefined as unknown as string);
      expect(result).toBe('');
    });
  });

  describe('getNatoName()', () => {
    it('should return the NATO name for a user ID', () => {
      const result = walkieService.getNatoName('<@U2YJQN2KB>');
      expect(result).toBe('Sierra Foxtrot');
    });

    it('should return the original string if no NATO name is found', () => {
      const result = walkieService.getNatoName('test');
      expect(result).toBe('test');
    });
  });

  describe('walkieTalkie()', () => {
    // This code does work  but this test fails hrmrmrmr.
    it('should send a message with the correct format when natoName is found', () => {
      const request = {
        text: '<@U2YJQN2KB | jrjrjr> test',
        user_id: 'U12345',
        response_url: 'http://response.url',
      } as SlashCommandRequest;

      const sendResponseSpy = jest.spyOn(walkieService.slackService, 'sendResponse').mockImplementation(() => {});

      walkieService.walkieTalkie(request);

      expect(sendResponseSpy).toHaveBeenCalledWith(request.response_url, {
        attachments: [
          {
            text: ':walkietalkie: *chk* Sierra Foxtrot test over. *chk* :walkietalkie:',
          },
        ],
        response_type: 'in_channel',
        text: '<@U12345>',
      });
    });

    it('should send a message with the correct format even when natoName is not found', () => {
      const request = {
        text: '<@U12345|JohnDoe> test',
        user_id: 'U12345',
        response_url: 'http://response.url',
      } as SlashCommandRequest;
      const sendResponseSpy = jest.spyOn(walkieService.slackService, 'sendResponse').mockImplementation(() => {});

      walkieService.walkieTalkie(request);

      expect(sendResponseSpy).toHaveBeenCalledWith(request.response_url, {
        attachments: [
          {
            text: ':walkietalkie: *chk* <@U12345|JohnDoe> test over. *chk* :walkietalkie:',
          },
        ],
        response_type: 'in_channel',
        text: '<@U12345>',
      });
    });

    it('should do nothing if the text is empty', () => {
      const request = {
        text: '',
        user_id: 'U12345',
        response_url: 'http://response.url',
      } as SlashCommandRequest;
      const sendResponseSpy = jest.spyOn(walkieService.slackService, 'sendResponse').mockImplementation(() => {});

      walkieService.walkieTalkie(request);

      expect(sendResponseSpy).not.toHaveBeenCalled();
    });
  });
});
