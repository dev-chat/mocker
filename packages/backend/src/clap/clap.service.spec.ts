import { ClapService } from './clap.service';

describe('ClapService', () => {
  let clapService: ClapService;

  beforeEach(() => {
    clapService = new ClapService();
  });

  describe('clap()', () => {
    it('should clap a users input with multiple words', () => {
      const messageSpy = jest.spyOn(clapService.slackService, 'sendResponse').mockImplementation(() => {});
      clapService.clap('test this out', 'U12345', 'http://response.url');
      expect(messageSpy).toHaveBeenCalledWith('http://response.url', {
        attachments: [
          {
            text: 'test :clap: this :clap: out :clap:',
          },
        ],
        response_type: 'in_channel',
        text: '<@U12345>',
      });
    });

    it('shoudl not clap if no text is passed in', () => {
      const messageSpy = jest.spyOn(clapService.slackService, 'sendResponse').mockImplementation(() => {});
      clapService.clap('', 'U12345', 'http://response.url');
      expect(messageSpy).not.toHaveBeenCalled();
    });
  });
});
