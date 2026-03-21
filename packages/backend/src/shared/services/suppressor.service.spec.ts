import { SuppressorService } from './suppressor.service';

describe('SuppressorService', () => {
  let suppressorService: SuppressorService;

  beforeEach(() => {
    jest.clearAllMocks();
    suppressorService = new SuppressorService();

    suppressorService.webService = {
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
      deleteMessage: jest.fn(),
    } as never;

    suppressorService.translationService = {
      translate: jest.fn().mockResolvedValue('translated'),
    } as never;

    suppressorService.aiService = {
      generateCorpoSpeak: jest.fn().mockResolvedValue('corpo'),
    } as never;

    suppressorService.muzzlePersistenceService = {
      incrementMessageSuppressions: jest.fn(),
      incrementCharacterSuppressions: jest.fn(),
      incrementWordSuppressions: jest.fn(),
      isUserMuzzled: jest.fn().mockResolvedValue(false),
      removeMuzzle: jest.fn().mockResolvedValue(true),
      getMuzzle: jest.fn().mockResolvedValue(null),
      trackDeletedMessage: jest.fn(),
      getMuzzlesByTimePeriod: jest.fn().mockResolvedValue(0),
    } as never;

    suppressorService.backfirePersistenceService = {
      isBackfire: jest.fn().mockResolvedValue(false),
      removeBackfire: jest.fn().mockResolvedValue(true),
      getBackfireByUserId: jest.fn().mockResolvedValue(null),
      trackDeletedMessage: jest.fn(),
    } as never;

    suppressorService.counterPersistenceService = {
      isCounterMuzzled: jest.fn().mockResolvedValue(false),
      removeCounterMuzzle: jest.fn().mockResolvedValue(true),
      getCounterMuzzle: jest.fn().mockResolvedValue(null),
      incrementMessageSuppressions: jest.fn(),
      getInstance: jest.fn(),
    } as never;

    suppressorService.slackService = {
      containsTag: jest.fn().mockReturnValue(false),
      getBotByBotId: jest.fn().mockResolvedValue({ name: 'other-bot' }),
      getUserId: jest.fn(),
      getUserIdByCallbackId: jest.fn(),
      getBotId: jest.fn(),
      getAllUsers: jest.fn().mockResolvedValue([{ id: 'U1', name: 'alice' }]),
      getUserById: jest.fn().mockResolvedValue({ isBot: false }),
    } as never;
  });

  it('isBot returns true when user is bot', async () => {
    (suppressorService.slackService.getUserById as jest.Mock).mockResolvedValue({ isBot: true });
    await expect(suppressorService.isBot('U1', 'T1')).resolves.toBe(true);
  });

  it('findUserIdInBlocks finds nested user id', () => {
    const result = suppressorService.findUserIdInBlocks({ a: { b: '<@U12345>' } }, /<@U[A-Z0-9]+>/);
    expect(result).toBe('<@U12345>');
  });

  it('findUserInBlocks finds user by name in block text', async () => {
    const result = await suppressorService.findUserInBlocks(
      [{ elements: [{ text: 'hello alice' }] }] as never,
      [{ id: 'U1', name: 'alice' }] as never,
    );
    expect(result).toBe('U1');
  });

  it('isSuppressed checks all suppression sources', async () => {
    await expect(suppressorService.isSuppressed('U1', 'T1')).resolves.toBe(false);

    (suppressorService.backfirePersistenceService.isBackfire as jest.Mock).mockResolvedValue(true);
    await expect(suppressorService.isSuppressed('U1', 'T1')).resolves.toBe(true);
  });

  it('removeSuppression removes from all active suppression types', async () => {
    (suppressorService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(true);
    (suppressorService.backfirePersistenceService.isBackfire as jest.Mock).mockResolvedValue(true);
    (suppressorService.counterPersistenceService.isCounterMuzzled as jest.Mock).mockResolvedValue(true);

    await suppressorService.removeSuppression('U1', 'T1');

    expect(suppressorService.counterPersistenceService.removeCounterMuzzle).toHaveBeenCalledWith('U1');
    expect(suppressorService.muzzlePersistenceService.removeMuzzle).toHaveBeenCalledWith('U1', 'T1');
    expect(suppressorService.backfirePersistenceService.removeBackfire).toHaveBeenCalledWith('U1', 'T1');
  });

  it('sendFallbackSuppressedMessage updates suppression counters', () => {
    const output = suppressorService.sendFallbackSuppressedMessage(
      'hello world this is text',
      10,
      suppressorService.muzzlePersistenceService as never,
    );

    expect(output.length).toBeGreaterThan(0);
    expect(suppressorService.muzzlePersistenceService.incrementMessageSuppressions).toHaveBeenCalledWith(10);
    expect(suppressorService.muzzlePersistenceService.incrementCharacterSuppressions).toHaveBeenCalled();
    expect(suppressorService.muzzlePersistenceService.incrementWordSuppressions).toHaveBeenCalled();
  });

  it('logTranslateSuppression catches persistence errors', () => {
    (suppressorService.muzzlePersistenceService.incrementMessageSuppressions as jest.Mock).mockImplementation(() => {
      throw new Error('db fail');
    });
    const loggerSpy = jest.spyOn(suppressorService.logger, 'error');

    suppressorService.logTranslateSuppression('some text', 1, suppressorService.muzzlePersistenceService as never);
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('sendSuppressedMessage uses translation for normal channels', async () => {
    await suppressorService.sendSuppressedMessage(
      'C123',
      'U1',
      'hello world',
      '123',
      1,
      suppressorService.muzzlePersistenceService as never,
    );

    expect(suppressorService.translationService.translate).toHaveBeenCalled();
    expect(suppressorService.webService.sendMessage).toHaveBeenCalledWith(
      'C123',
      expect.stringContaining('<@U1> says'),
    );
  });

  it('sendSuppressedMessage uses corpo mode for libworkchat', async () => {
    await suppressorService.sendSuppressedMessage(
      '#libworkchat',
      'U1',
      'hello world',
      '123',
      1,
      suppressorService.muzzlePersistenceService as never,
    );

    expect(suppressorService.aiService.generateCorpoSpeak).toHaveBeenCalled();
  });

  it('sendSuppressedMessage falls back when translation fails', async () => {
    (suppressorService.translationService.translate as jest.Mock).mockRejectedValue(new Error('translate fail'));

    await suppressorService.sendSuppressedMessage(
      'C123',
      'U1',
      'hello world',
      '123',
      1,
      suppressorService.muzzlePersistenceService as never,
    );

    expect(suppressorService.webService.sendMessage).toHaveBeenCalled();
  });

  it('sendSuppressedMessage skips when too many words', async () => {
    const longText = new Array(260).fill('word').join(' ');
    await suppressorService.sendSuppressedMessage(
      'C123',
      'U1',
      longText,
      '123',
      1,
      suppressorService.muzzlePersistenceService as never,
    );

    expect(suppressorService.translationService.translate).not.toHaveBeenCalled();
    expect(suppressorService.aiService.generateCorpoSpeak).not.toHaveBeenCalled();
  });

  it('shouldBackfire calculates chance from historical muzzles', async () => {
    (suppressorService.muzzlePersistenceService.getMuzzlesByTimePeriod as jest.Mock).mockResolvedValue(3);
    jest.spyOn(Math, 'random').mockReturnValue(0.1);

    await expect(suppressorService.shouldBackfire('U1', 'T1')).resolves.toBe(true);
  });

  it('shouldBotMessageBeMuzzled returns false without bot id', async () => {
    await expect(
      suppressorService.shouldBotMessageBeMuzzled({ team_id: 'T1', event: { text: '<@U1>' } } as never),
    ).resolves.toBe(false);
  });

  it('shouldBotMessageBeMuzzled returns false for muzzle bot', async () => {
    (suppressorService.slackService.getBotByBotId as jest.Mock).mockResolvedValue({ name: 'muzzle' });

    await expect(
      suppressorService.shouldBotMessageBeMuzzled({ team_id: 'T1', event: { bot_id: 'B1', text: '<@U1>' } } as never),
    ).resolves.toBe(false);
  });

  it('shouldBotMessageBeMuzzled returns user id when suppressed', async () => {
    (suppressorService.slackService.getUserId as jest.Mock).mockReturnValue('U1');
    (suppressorService.slackService.getBotId as jest.Mock).mockReturnValue('U1');
    (suppressorService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(true);

    await expect(
      suppressorService.shouldBotMessageBeMuzzled({
        team_id: 'T1',
        event: { bot_id: 'B1', text: '<@U1>', attachments: [{ text: 'x', pretext: 'y', callback_id: 'cb_U1' }] },
      } as never),
    ).resolves.toBe('U1');
  });

  it('handleBotMessage deletes and tracks muzzle deletion', async () => {
    jest.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as jest.Mock).mockResolvedValue(9);

    await suppressorService.handleBotMessage({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', ts: '1.2', user: 'Ubot' },
    } as never);

    expect(suppressorService.webService.deleteMessage).toHaveBeenCalled();
    expect(suppressorService.muzzlePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(9, 'A bot message');
  });

  it('handleBotMessage tracks backfire when no muzzle exists', async () => {
    jest.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as jest.Mock).mockResolvedValue(null);
    (suppressorService.backfirePersistenceService.getBackfireByUserId as jest.Mock).mockResolvedValue(7);

    await suppressorService.handleBotMessage({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', ts: '1.2', user: 'Ubot' },
    } as never);

    expect(suppressorService.backfirePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(
      7,
      'A bot user message',
    );
  });

  it('handleBotMessage increments counter suppression when countered', async () => {
    jest.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as jest.Mock).mockResolvedValue(null);
    (suppressorService.backfirePersistenceService.getBackfireByUserId as jest.Mock).mockResolvedValue(null);
    (suppressorService.counterPersistenceService.getCounterMuzzle as jest.Mock).mockResolvedValue({ counterId: 22 });

    await suppressorService.handleBotMessage({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', ts: '1.2', user: 'Ubot' },
    } as never);

    expect(suppressorService.counterPersistenceService.incrementMessageSuppressions).toHaveBeenCalledWith(22);
  });
});
