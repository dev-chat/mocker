import { SlackService } from '../slack/slack.service';
import { WebService } from '../web/web.service';
import { ConfessionService } from './confession.service';

describe('ConfessionService', () => {
  let confessionService: ConfessionService;
  let webService: WebService;
  let slackService: SlackService;

  beforeEach(() => {
    webService = new WebService();
    slackService = new SlackService();
    confessionService = new ConfessionService(webService, slackService);
  });

  it('should confess', async () => {
    const requestorId = 'U123456';
    const channelId = 'C123456';
    const confession = 'I am a banana';
    const sendMessageSpy = jest.spyOn(webService, 'sendMessage');

    await confessionService.confess(requestorId, channelId, confession);

    expect(sendMessageSpy).toHaveBeenCalledWith(
      channelId,
      `:chicken: <@${requestorId}> :chicken: says: \`${confession}\``,
    );
  });
});
