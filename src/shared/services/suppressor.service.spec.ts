import { UpdateResult } from 'typeorm';
import { SuppressorService } from './suppressor.service';
import { EventRequest } from '../models/slack/slack-models';
import { MuzzlePersistenceService } from '../../services/muzzle/muzzle.persistence.service';
import { MAX_WORD_LENGTH } from '../../services/muzzle/constants';
import { SlackService } from '../../services/slack/slack.service';

describe('SuppressorService', () => {
  let suppressorService: SuppressorService;
  let slackInstance: SlackService;

  beforeEach(() => {
    suppressorService = new SuppressorService();
    slackInstance = new SlackService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  describe('muzzle()', () => {
    beforeEach(() => {
      const mockResolve = { raw: 'whatever' };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), 'incrementMessageSuppressions')
        .mockResolvedValue(mockResolve as UpdateResult);
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), 'incrementCharacterSuppressions')
        .mockResolvedValue(mockResolve as UpdateResult);
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), 'incrementWordSuppressions')
        .mockResolvedValue(mockResolve as UpdateResult);
      jest
        .spyOn(suppressorService, 'getReplacementWord')
        .mockImplementation((word: string, isFirstWord: boolean, isLastWord: boolean, replacementText: string) => {
          const isRandomEven = (): boolean => true;
          replacementText = '..mMm..';
          const text =
            isRandomEven() && word.length < MAX_WORD_LENGTH && word !== ' ' && !slackInstance.containsTag(word)
              ? `*${word}*`
              : replacementText;

          if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
            return `${text} `;
          }
          return text;
        });
    });

    it('should always muzzle a tagged user', () => {
      const testSentence = '<@U2TKJ> <@JKDSF> <@SDGJSK> <@LSKJDSG> <@lkjdsa> <@LKSJDF> <@SDLJG> <@jrjrjr> <@fudka>';
      expect(
        suppressorService.sendFallbackSuppressedMessage(testSentence, 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm..');
    });

    it('should always muzzle <!channel>', () => {
      const testSentence = '<!channel>';
      expect(
        suppressorService.sendFallbackSuppressedMessage(testSentence, 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm..');
    });

    it('should always muzzle <!here>', () => {
      const testSentence = '<!here>';
      expect(
        suppressorService.sendFallbackSuppressedMessage(testSentence, 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm..');
    });

    it('should always muzzle a word with length > 10', () => {
      const testSentence = 'this.is.a.way.to.game.the.system';
      expect(
        suppressorService.sendFallbackSuppressedMessage(testSentence, 1, suppressorService.muzzlePersistenceService),
      ).toBe('..mMm..');
    });
  });

  describe('shouldBotMessageBeMuzzled()', () => {
    let mockRequest: EventRequest;
    beforeEach(() => {
      /* tslint:disable-next-line:no-object-literal-type-assertion */
      mockRequest = {
        event: {
          subtype: 'bot_message',
          username: 'not_muzzle',
          text: '<@123>',
          attachments: [
            {
              callback_id: 'LKJSF_123',
              pretext: '<@123>',
              text: '<@123>',
            },
          ],
        },
      } as EventRequest;
    });

    describe('when a user is muzzled', () => {
      beforeEach(() => {
        jest
          .spyOn(MuzzlePersistenceService.getInstance(), 'isUserMuzzled')
          .mockImplementation(() => new Promise((resolve) => resolve(true)));
      });

      it('should return true if an id is present in the event.text ', async () => {
        mockRequest.event.attachments = [];
        const result = await suppressorService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return true if an id is present in the event.attachments[0].text', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].pretext = 'whatever';
        mockRequest.event.attachments[0].callback_id = 'whatever';
        const result = await suppressorService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return true if an id is present in the event.attachments[0].pretext', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].text = 'whatever';
        mockRequest.event.attachments[0].callback_id = 'whatever';
        const result = await suppressorService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return the id present in the event.attachments[0].callback_id if an id is present', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].text = 'whatever';
        mockRequest.event.attachments[0].pretext = 'whatever';
        const result = await suppressorService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });
    });

    describe('when a user is not muzzled', () => {
      beforeEach(() => {
        jest
          .spyOn(MuzzlePersistenceService.getInstance(), 'isUserMuzzled')
          .mockImplementation(() => new Promise((resolve) => resolve(false)));
      });

      it('should return false if there is no id present in any fields', async () => {
        mockRequest.event.text = 'no id';
        mockRequest.event.callback_id = 'TEST_TEST';
        mockRequest.event.attachments[0].text = 'test';
        mockRequest.event.attachments[0].pretext = 'test';
        mockRequest.event.attachments[0].callback_id = 'TEST';
        const result = await suppressorService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(false);
      });

      it('should return false if the message is not a bot_message', async () => {
        mockRequest.event.subtype = 'not_bot_message';
        expect(await suppressorService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });

      it('should return false if the requesting user is not muzzled', async () => {
        mockRequest.event.text = '<@456>';
        mockRequest.event.attachments[0].text = '<@456>';
        mockRequest.event.attachments[0].pretext = '<@456>';
        mockRequest.event.attachments[0].callback_id = 'TEST_456';
        expect(await suppressorService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });

      it('should return false if the bot username is muzzle', async () => {
        mockRequest.event.username = 'muzzle';
        expect(await suppressorService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });
    });
  });
});
