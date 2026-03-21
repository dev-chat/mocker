import { SuppressorService } from './suppressor.service';

describe('SuppressorService', () => {
  let suppressorService: SuppressorService;

  beforeEach(() => {
    jest.clearAllMocks();
    suppressorService = new SuppressorService();

    suppressorService.muzzlePersistenceService = {
      incrementMessageSuppressions: jest.fn().mockResolvedValue({ raw: 'ok' }),
      incrementCharacterSuppressions: jest.fn().mockResolvedValue({ raw: 'ok' }),
      incrementWordSuppressions: jest.fn().mockResolvedValue({ raw: 'ok' }),
      isUserMuzzled: jest.fn().mockResolvedValue(false),
    } as never;

    suppressorService.backfirePersistenceService = {
      isBackfire: jest.fn().mockResolvedValue(false),
    } as never;

    suppressorService.counterPersistenceService = {
      isCounterMuzzled: jest.fn().mockResolvedValue(false),
    } as never;

    suppressorService.slackService = {
      containsTag: jest.fn(),
      getBotByBotId: jest.fn(),
      getUserId: jest.fn(),
      getUserIdByCallbackId: jest.fn(),
      getBotId: jest.fn(),
      getAllUsers: jest.fn().mockResolvedValue([]),
    } as never;

    jest
      .spyOn(suppressorService, 'getFallbackReplacementWord')
      .mockImplementation((_word: string, isFirstWord: boolean, isLastWord: boolean) => {
        const replacement = '..mMm..';
        if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
          return `${replacement} `;
        }
        return replacement;
      });
  });

  describe('sendFallbackSuppressedMessage', () => {
    it('always muzzles tagged users', () => {
      const testSentence = '<@U2TKJ> <@JKDSF> <@SDGJSK>';
      expect(
        suppressorService.sendFallbackSuppressedMessage(testSentence, 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm.. ..mMm.. ..mMm..');
    });

    it('always muzzles <!channel> and <!here>', () => {
      expect(
        suppressorService.sendFallbackSuppressedMessage('<!channel>', 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm..');
      expect(
        suppressorService.sendFallbackSuppressedMessage('<!here>', 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm..');
    });

    it('always muzzles long words', () => {
      expect(
        suppressorService.sendFallbackSuppressedMessage(
          'this.is.a.way.to.game.the.system',
          1,
          suppressorService.muzzlePersistenceService,
        ),
      ).toBe('..mMm..');
    });
  });

  describe('shouldBotMessageBeMuzzled', () => {
    it('returns false when event has no bot id', async () => {
      const result = await suppressorService.shouldBotMessageBeMuzzled({
        team_id: 'T1',
        event: { text: '<@U123>' },
      } as never);

      expect(result).toBe(false);
    });

    it('returns false for muzzle bot messages', async () => {
      (suppressorService.slackService.getBotByBotId as jest.Mock).mockResolvedValue({ name: 'muzzle' });

      const result = await suppressorService.shouldBotMessageBeMuzzled({
        team_id: 'T1',
        event: { bot_id: 'B1', text: '<@U123>' },
      } as never);

      expect(result).toBe(false);
    });

    it('returns user id when mentioned user is suppressed', async () => {
      (suppressorService.slackService.getBotByBotId as jest.Mock).mockResolvedValue({ name: 'other-bot' });
      (suppressorService.slackService.getUserId as jest.Mock).mockReturnValue('U123');
      (suppressorService.slackService.getBotId as jest.Mock).mockReturnValue('U123');
      (suppressorService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(true);

      const result = await suppressorService.shouldBotMessageBeMuzzled({
        team_id: 'T1',
        event: {
          bot_id: 'B1',
          text: '<@U123>',
          attachments: [{ text: 'x', pretext: 'x', callback_id: 'cb_123' }],
        },
      } as never);

      expect(result).toBe('U123');
    });
  });
});
