import { vi } from 'vitest';
import { SuppressorService } from './suppressor.service';

describe('SuppressorService', () => {
  let suppressorService: SuppressorService;

  beforeEach(() => {
    vi.clearAllMocks();
    suppressorService = new SuppressorService();

    suppressorService.webService = {
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      deleteMessage: vi.fn(),
    } as never;

    suppressorService.translationService = {
      translate: vi.fn().mockResolvedValue('translated'),
    } as never;

    suppressorService.aiService = {
      generateCorpoSpeak: vi.fn().mockResolvedValue('corpo'),
    } as never;

    suppressorService.muzzlePersistenceService = {
      incrementMessageSuppressions: vi.fn(),
      incrementCharacterSuppressions: vi.fn(),
      incrementWordSuppressions: vi.fn(),
      isUserMuzzled: vi.fn().mockResolvedValue(false),
      removeMuzzle: vi.fn().mockResolvedValue(true),
      getMuzzle: vi.fn().mockResolvedValue(null),
      trackDeletedMessage: vi.fn(),
      getMuzzlesByTimePeriod: vi.fn().mockResolvedValue(0),
    } as never;

    suppressorService.backfirePersistenceService = {
      isBackfire: vi.fn().mockResolvedValue(false),
      removeBackfire: vi.fn().mockResolvedValue(true),
      getBackfireByUserId: vi.fn().mockResolvedValue(null),
      trackDeletedMessage: vi.fn(),
    } as never;

    suppressorService.counterPersistenceService = {
      isCounterMuzzled: vi.fn().mockResolvedValue(false),
      removeCounterMuzzle: vi.fn().mockResolvedValue(true),
      getCounterMuzzle: vi.fn().mockResolvedValue(null),
      incrementMessageSuppressions: vi.fn(),
      getInstance: vi.fn(),
    } as never;

    suppressorService.slackService = {
      containsTag: vi.fn().mockReturnValue(false),
      getBotByBotId: vi.fn().mockResolvedValue({ name: 'other-bot' }),
      getUserId: vi.fn(),
      getUserIdByCallbackId: vi.fn(),
      getBotId: vi.fn(),
      getAllUsers: vi.fn().mockResolvedValue([{ id: 'U1', name: 'alice' }]),
      getUserById: vi.fn().mockResolvedValue({ isBot: false }),
    } as never;
  });

  it('isBot returns true when user is bot', async () => {
    (suppressorService.slackService.getUserById as Mock).mockResolvedValue({ isBot: true });
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

    (suppressorService.backfirePersistenceService.isBackfire as Mock).mockResolvedValue(true);
    await expect(suppressorService.isSuppressed('U1', 'T1')).resolves.toBe(true);
  });

  it('removeSuppression removes from all active suppression types', async () => {
    (suppressorService.muzzlePersistenceService.isUserMuzzled as Mock).mockResolvedValue(true);
    (suppressorService.backfirePersistenceService.isBackfire as Mock).mockResolvedValue(true);
    (suppressorService.counterPersistenceService.isCounterMuzzled as Mock).mockResolvedValue(true);

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
    (suppressorService.muzzlePersistenceService.incrementMessageSuppressions as Mock).mockImplementation(() => {
      throw new Error('db fail');
    });
    const loggerSpy = vi.spyOn(suppressorService.logger, 'error');

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
    (suppressorService.translationService.translate as Mock).mockRejectedValue(new Error('translate fail'));

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
    (suppressorService.muzzlePersistenceService.getMuzzlesByTimePeriod as Mock).mockResolvedValue(3);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    await expect(suppressorService.shouldBackfire('U1', 'T1')).resolves.toBe(true);
  });

  it('shouldBotMessageBeMuzzled returns false without bot id', async () => {
    await expect(
      suppressorService.shouldBotMessageBeMuzzled({ team_id: 'T1', event: { text: '<@U1>' } } as never),
    ).resolves.toBe(false);
  });

  it('shouldBotMessageBeMuzzled returns false for muzzle bot', async () => {
    (suppressorService.slackService.getBotByBotId as Mock).mockResolvedValue({ name: 'muzzle' });

    await expect(
      suppressorService.shouldBotMessageBeMuzzled({ team_id: 'T1', event: { bot_id: 'B1', text: '<@U1>' } } as never),
    ).resolves.toBe(false);
  });

  it('shouldBotMessageBeMuzzled returns user id when suppressed', async () => {
    (suppressorService.slackService.getUserId as Mock).mockReturnValue('U1');
    (suppressorService.slackService.getBotId as Mock).mockReturnValue('U1');
    (suppressorService.muzzlePersistenceService.isUserMuzzled as Mock).mockResolvedValue(true);

    await expect(
      suppressorService.shouldBotMessageBeMuzzled({
        team_id: 'T1',
        event: { bot_id: 'B1', text: '<@U1>', attachments: [{ text: 'x', pretext: 'y', callback_id: 'cb_U1' }] },
      } as never),
    ).resolves.toBe('U1');
  });

  it('handleBotMessage deletes and tracks muzzle deletion', async () => {
    vi.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as Mock).mockResolvedValue(9);

    await suppressorService.handleBotMessage({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', ts: '1.2', user: 'Ubot' },
    } as never);

    expect(suppressorService.webService.deleteMessage).toHaveBeenCalled();
    expect(suppressorService.muzzlePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(9, 'A bot message');
  });

  it('handleBotMessage tracks backfire when no muzzle exists', async () => {
    vi.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as Mock).mockResolvedValue(null);
    (suppressorService.backfirePersistenceService.getBackfireByUserId as Mock).mockResolvedValue(7);

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
    vi.spyOn(suppressorService, 'shouldBotMessageBeMuzzled').mockResolvedValue('U1');
    (suppressorService.muzzlePersistenceService.getMuzzle as Mock).mockResolvedValue(null);
    (suppressorService.backfirePersistenceService.getBackfireByUserId as Mock).mockResolvedValue(null);
    (suppressorService.counterPersistenceService.getCounterMuzzle as Mock).mockResolvedValue({ counterId: 22 });

    await suppressorService.handleBotMessage({
      team_id: 'T1',
      event: { type: 'message', channel: 'C1', ts: '1.2', user: 'Ubot' },
    } as never);

    expect(suppressorService.counterPersistenceService.incrementMessageSuppressions).toHaveBeenCalledWith(22);
  });
});
