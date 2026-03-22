import { ABUSE_PENALTY_TIME } from '../muzzle/constants';
import type { EventRequest } from '../shared/models/slack/slack-models';
import { BackfireService } from './backfire.service';

describe('BackfireService', () => {
  let service: BackfireService;

  type BackfireServiceDependencies = BackfireService & {
    backfirePersistenceService: typeof backfirePersistenceService;
    webService: typeof webService;
    slackService: typeof slackService;
  };

  const backfirePersistenceService = {
    addBackfireTime: jest.fn(),
    getBackfireByUserId: jest.fn(),
    getSuppressions: jest.fn(),
    addSuppression: jest.fn(),
    trackDeletedMessage: jest.fn(),
    isBackfire: jest.fn(),
  };

  const webService = {
    deleteMessage: jest.fn(),
    sendMessage: jest.fn(),
  };

  const slackService = {
    containsTag: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BackfireService();
    const dependencyTarget = service as unknown as BackfireServiceDependencies;
    dependencyTarget.backfirePersistenceService = backfirePersistenceService;
    dependencyTarget.webService = webService;
    dependencyTarget.slackService = slackService;
  });

  it('delegates addBackfireTime', () => {
    service.addBackfireTime('U1', 'T1', 1000);

    expect(backfirePersistenceService.addBackfireTime).toHaveBeenCalledWith('U1', 'T1', 1000);
  });

  it('sends suppressed message when backfire exists and suppressions are below max', async () => {
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(10);
    backfirePersistenceService.getSuppressions.mockResolvedValue('1');
    const sendSuppressedSpy = jest.spyOn(service, 'sendSuppressedMessage').mockImplementation(async () => undefined);

    await service.sendBackfiredMessage('C1', 'U1', 'hello', '1.23', 'T1');

    expect(backfirePersistenceService.addSuppression).toHaveBeenCalledWith('U1', 'T1');
    expect(sendSuppressedSpy).toHaveBeenCalledWith('C1', 'U1', 'hello', '1.23', 10, backfirePersistenceService);
  });

  it('deletes and tracks when suppression limit is hit', async () => {
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(10);
    backfirePersistenceService.getSuppressions.mockResolvedValue('999');

    await service.sendBackfiredMessage('C1', 'U1', 'hello', '1.23', 'T1');

    expect(webService.deleteMessage).toHaveBeenCalledWith('C1', '1.23', 'U1');
    expect(backfirePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(10, 'hello');
  });

  it('does nothing in sendBackfiredMessage when user has no backfire id', async () => {
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(undefined);

    await service.sendBackfiredMessage('C1', 'U1', 'hello', '1.23', 'T1');

    expect(backfirePersistenceService.getSuppressions).not.toHaveBeenCalled();
    expect(webService.deleteMessage).not.toHaveBeenCalled();
  });

  it('handles backfired message without tag by deleting and sending suppressed flow', async () => {
    const sendBackfiredSpy = jest.spyOn(service, 'sendBackfiredMessage').mockResolvedValue(undefined);
    backfirePersistenceService.isBackfire.mockResolvedValue(true);
    slackService.containsTag.mockReturnValue(false);

    await service.handle({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', user: 'U1', ts: '1.23', text: 'hello' },
    } as EventRequest);

    expect(webService.deleteMessage).toHaveBeenCalledWith('C1', '1.23', 'U1');
    expect(sendBackfiredSpy).toHaveBeenCalledWith('C1', 'U1', 'hello', '1.23', 'T1');
  });

  it('applies penalty when user tags while backfired and topic-change eligible', async () => {
    backfirePersistenceService.isBackfire.mockResolvedValue(true);
    slackService.containsTag.mockReturnValue(true);
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(7);
    webService.sendMessage.mockResolvedValue({ ok: true });

    await service.handle({
      team_id: 'T1',
      event: {
        type: 'message',
        subtype: 'channel_topic',
        channel: 'C1',
        user: 'U1',
        ts: '1.23',
        text: '<!channel> hi',
      },
    } as EventRequest);

    expect(backfirePersistenceService.addBackfireTime).toHaveBeenCalledWith('U1', 'T1', ABUSE_PENALTY_TIME);
    expect(webService.deleteMessage).toHaveBeenCalledWith('C1', '1.23', 'U1');
    expect(backfirePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(7, '<!channel> hi');
    expect(webService.sendMessage).toHaveBeenCalled();
  });

  it('logs warning when backfire id is missing for tagged flow', async () => {
    const warnSpy = jest.spyOn(service.logger, 'warn').mockImplementation(() => undefined);
    backfirePersistenceService.isBackfire.mockResolvedValue(true);
    slackService.containsTag.mockReturnValue(true);
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(undefined);

    await service.handle({
      team_id: 'T1',
      event: { type: 'message', subtype: 'channel_topic', channel: 'C1', user: 'U1', ts: '1.23', text: 'x' },
    } as EventRequest);

    expect(warnSpy).toHaveBeenCalledWith('Unable to find backfireId for U1');
  });

  it('logs errors when tag warning sendMessage fails', async () => {
    const errSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
    backfirePersistenceService.isBackfire.mockResolvedValue(true);
    slackService.containsTag.mockReturnValue(true);
    backfirePersistenceService.getBackfireByUserId.mockResolvedValue(7);
    webService.sendMessage.mockRejectedValue(new Error('send failed'));

    await service.handle({
      team_id: 'T1',
      event: { type: 'message', subtype: 'channel_topic', channel: 'C1', user: 'U1', ts: '1.23', text: 'x' },
    } as EventRequest);
    await Promise.resolve();

    expect(errSpy).toHaveBeenCalled();
  });

  it('ignores non-message events when not topic-change eligible', async () => {
    backfirePersistenceService.isBackfire.mockResolvedValue(true);

    await service.handle({
      team_id: 'T1',
      event: { type: 'app_mention', subtype: 'bot_message', channel: 'C1', user: 'U1', ts: '1.23', text: 'x' },
    } as EventRequest);

    expect(backfirePersistenceService.isBackfire).not.toHaveBeenCalled();
  });
});
