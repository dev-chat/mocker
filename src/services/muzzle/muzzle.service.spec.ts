/* eslint-disable @typescript-eslint/camelcase */
import { when } from 'jest-when';
import { UpdateResult } from 'typeorm';
import { Muzzle } from '../../shared/db/models/Muzzle';
import { EventRequest, SlackUser } from '../../shared/models/slack/slack-models';
import { SlackService } from '../slack/slack.service';
import { WebService } from '../web/web.service';
import { MAX_SUPPRESSIONS, MAX_WORD_LENGTH } from './constants';
import * as muzzleUtils from './muzzle-utilities';
import { MuzzlePersistenceService } from './muzzle.persistence.service';
import { MuzzleService } from './muzzle.service';

describe('MuzzleService', () => {
  const testData = {
    user123: '123',
    user2: '456',
    user3: '789',
    requestor: '666',
  };

  let muzzleService: MuzzleService;
  let slackInstance: SlackService;

  beforeEach(() => {
    muzzleService = new MuzzleService();
    slackInstance = SlackService.getInstance();
    slackInstance.userList = [
      { id: '123', name: 'test123' },
      { id: '456', name: 'test456' },
      { id: '789', name: 'test789' },
      { id: '666', name: 'requestor' },
    ] as SlackUser[];
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
        .spyOn(muzzleService, 'getReplacementWord')
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
      expect(muzzleService.muzzle(testSentence, 1)).toBe(
        '..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm.. ..mMm..',
      );
    });

    it('should always muzzle <!channel>', () => {
      const testSentence = '<!channel>';
      expect(muzzleService.muzzle(testSentence, 1)).toBe('..mMm..');
    });

    it('should always muzzle <!here>', () => {
      const testSentence = '<!here>';
      expect(muzzleService.muzzle(testSentence, 1)).toBe('..mMm..');
    });

    it('should always muzzle a word with length > 10', () => {
      const testSentence = 'this.is.a.way.to.game.the.system';
      expect(muzzleService.muzzle(testSentence, 1)).toBe('..mMm..');
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
          .mockImplementation(() => new Promise(resolve => resolve(true)));
      });

      it('should return true if an id is present in the event.text ', async () => {
        mockRequest.event.attachments = [];
        const result = await muzzleService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return true if an id is present in the event.attachments[0].text', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].pretext = 'whatever';
        mockRequest.event.attachments[0].callback_id = 'whatever';
        const result = await muzzleService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return true if an id is present in the event.attachments[0].pretext', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].text = 'whatever';
        mockRequest.event.attachments[0].callback_id = 'whatever';
        const result = await muzzleService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });

      it('should return the id present in the event.attachments[0].callback_id if an id is present', async () => {
        mockRequest.event.text = 'whatever';
        mockRequest.event.attachments[0].text = 'whatever';
        mockRequest.event.attachments[0].pretext = 'whatever';
        const result = await muzzleService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(true);
      });
    });

    describe('when a user is not muzzled', () => {
      beforeEach(() => {
        jest
          .spyOn(MuzzlePersistenceService.getInstance(), 'isUserMuzzled')
          .mockImplementation(() => new Promise(resolve => resolve(false)));
      });

      it('should return false if there is no id present in any fields', async () => {
        mockRequest.event.text = 'no id';
        mockRequest.event.callback_id = 'TEST_TEST';
        mockRequest.event.attachments[0].text = 'test';
        mockRequest.event.attachments[0].pretext = 'test';
        mockRequest.event.attachments[0].callback_id = 'TEST';
        const result = await muzzleService.shouldBotMessageBeMuzzled(mockRequest);
        expect(result).toBe(false);
      });

      it('should return false if the message is not a bot_message', async () => {
        mockRequest.event.subtype = 'not_bot_message';
        expect(await muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });

      it('should return false if the requesting user is not muzzled', async () => {
        mockRequest.event.text = '<@456>';
        mockRequest.event.attachments[0].text = '<@456>';
        mockRequest.event.attachments[0].pretext = '<@456>';
        mockRequest.event.attachments[0].callback_id = 'TEST_456';
        expect(await muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });

      it('should return false if the bot username is muzzle', async () => {
        mockRequest.event.username = 'muzzle';
        expect(await muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(false);
      });
    });
  });

  describe('addUserToMuzzled()', () => {
    describe('muzzled', () => {
      describe('when the user is not already muzzled', () => {
        let mockAddMuzzle: jest.SpyInstance;
        let mockMaxMuzzles: jest.SpyInstance;
        beforeEach(() => {
          const mockMuzzle = { id: 1 };
          const persistenceService = MuzzlePersistenceService.getInstance();
          mockAddMuzzle = jest.spyOn(persistenceService, 'addMuzzle').mockResolvedValue(mockMuzzle as Muzzle);
          mockMaxMuzzles = jest.spyOn(persistenceService, 'isMaxMuzzlesReached').mockResolvedValue(false);
          jest
            .spyOn(persistenceService, 'isUserMuzzled')
            .mockImplementation(() => new Promise(resolve => resolve(false)));

          jest.spyOn(muzzleUtils, 'shouldBackfire').mockImplementation(() => false);
        });

        it('should call MuzzlePersistenceService.addMuzzle()', async () => {
          await muzzleService.addUserToMuzzled(testData.user123, testData.requestor, 'test');
          expect(mockMaxMuzzles).toHaveBeenCalled();
          expect(mockAddMuzzle).toHaveBeenCalled();
        });
      });

      describe('when a user is already muzzled', () => {
        let addMuzzleMock: jest.SpyInstance;

        beforeEach(() => {
          jest.clearAllMocks();
          const mockMuzzle = { id: 1 };
          const persistenceService = MuzzlePersistenceService.getInstance();
          addMuzzleMock = jest.spyOn(persistenceService, 'addMuzzle').mockResolvedValue(mockMuzzle as Muzzle);

          jest.spyOn(muzzleUtils, 'shouldBackfire').mockImplementation(() => false);

          jest.spyOn(persistenceService, 'isUserMuzzled').mockImplementation(
            () =>
              new Promise(resolve => {
                resolve(true);
              }),
          );
        });

        it('should reject if a user tries to muzzle an already muzzled user', async () => {
          await muzzleService.addUserToMuzzled(testData.user123, testData.requestor, 'test').catch(e => {
            expect(e).toBe('test123 is already muzzled!');
            expect(addMuzzleMock).not.toHaveBeenCalled();
          });
        });

        it('should reject if a user tries to muzzle a user that does not exist', async () => {
          await muzzleService.addUserToMuzzled('', testData.requestor, 'test').catch(e => {
            expect(e).toBe(`Invalid username passed in. You can only muzzle existing slack users.`);
          });
        });
      });

      describe('when a requestor is already muzzled', () => {
        let addMuzzleMock: jest.SpyInstance;

        beforeEach(() => {
          jest.clearAllMocks();
          const mockMuzzle = { id: 1 };
          const persistenceService = MuzzlePersistenceService.getInstance();
          addMuzzleMock = jest.spyOn(persistenceService, 'addMuzzle').mockResolvedValue(mockMuzzle as Muzzle);

          jest.spyOn(muzzleUtils, 'shouldBackfire').mockImplementation(() => false);

          const mockIsUserMuzzled = jest.spyOn(persistenceService, 'isUserMuzzled');

          when(mockIsUserMuzzled)
            .calledWith(testData.requestor)
            .mockImplementation(() => new Promise(resolve => resolve(true)));
        });

        it('should reject if a requestor tries to muzzle someone while the requestor is muzzled', async () => {
          await muzzleService.addUserToMuzzled(testData.user123, testData.requestor, 'test').catch(e => {
            expect(e).toBe(`You can't muzzle someone if you are already muzzled!`);
            expect(addMuzzleMock).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('maxMuzzleLimit', () => {
      beforeEach(() => {
        const mockMuzzle = { id: 1 };
        const persistenceService = MuzzlePersistenceService.getInstance();
        jest.spyOn(persistenceService, 'addMuzzle').mockResolvedValue(mockMuzzle as Muzzle);

        jest.spyOn(muzzleUtils, 'shouldBackfire').mockImplementation(() => false);

        jest
          .spyOn(persistenceService, 'isMaxMuzzlesReached')
          .mockImplementation(() => new Promise(resolve => resolve(true)));

        jest
          .spyOn(persistenceService, 'isUserMuzzled')
          .mockImplementation(() => new Promise(resolve => resolve(false)));
      });

      it('should prevent a requestor from muzzling when isMaxMuzzlesReached is true', async () => {
        await muzzleService
          .addUserToMuzzled(testData.user3, testData.requestor, 'test')
          .catch(e => expect(e).toBe(`You're doing that too much. Only 2 muzzles are allowed per hour.`));
      });
    });
  });

  describe('sendMuzzledMessage', () => {
    let persistenceService: MuzzlePersistenceService;
    let webService: WebService;

    beforeEach(() => {
      persistenceService = MuzzlePersistenceService.getInstance();
      webService = WebService.getInstance();
    });

    describe('if a user is already muzzled', () => {
      let mockMuzzle: string;
      let mockSendMessage: jest.SpyInstance;
      let mockDeleteMessage: jest.SpyInstance;
      let mockTrackDeleted: jest.SpyInstance;
      let mockGetSuppressions: jest.SpyInstance;
      let mockGetMuzzle: jest.SpyInstance;

      beforeEach(() => {
        jest.clearAllMocks();
        mockMuzzle = '1234';

        mockDeleteMessage = jest.spyOn(webService, 'deleteMessage');
        mockSendMessage = jest.spyOn(webService, 'sendMessage').mockImplementation(() => true);
        mockTrackDeleted = jest.spyOn(persistenceService, 'trackDeletedMessage');
        mockGetSuppressions = jest.spyOn(persistenceService, 'getSuppressions');
        mockGetMuzzle = jest.spyOn(persistenceService, 'getMuzzle').mockResolvedValue(mockMuzzle);
      });

      it('should call getMuzzle, deleteMessage and sendMessage if suppressionCount is 0', async () => {
        mockGetSuppressions.mockResolvedValue('0');
        mockGetMuzzle.mockResolvedValue('1234');
        jest.spyOn(persistenceService, 'incrementStatefulSuppressions').mockResolvedValue();
        await muzzleService.sendMuzzledMessage('test', '12345', 'test', 'test');
        expect(mockGetMuzzle).toHaveBeenCalled();
        expect(mockDeleteMessage).toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalled();
      });

      it('should call getMuzzle, and deleteMessage not call sendMessage, but call trackDeletedMessage if suppressionCount >= MAX_SUPPRESSIONS', async () => {
        mockGetSuppressions.mockImplementation(() => new Promise(resolve => resolve(MAX_SUPPRESSIONS)));
        await muzzleService.sendMuzzledMessage('test', '1234', 'test', 'test');
        expect(mockDeleteMessage).toHaveBeenCalled();
        expect(mockGetMuzzle).toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockTrackDeleted).toHaveBeenCalled();
      });
    });

    describe('if a user is not muzzled', () => {
      let mockSendMessage: jest.SpyInstance;
      let mockTrackDeleted: jest.SpyInstance;
      let mockGetMuzzle: jest.SpyInstance;

      beforeEach(() => {
        jest.clearAllMocks();
        mockSendMessage = jest.spyOn(webService, 'sendMessage').mockImplementation(() => true);
        mockTrackDeleted = jest.spyOn(persistenceService, 'trackDeletedMessage');

        mockGetMuzzle = jest
          .spyOn(persistenceService, 'getMuzzle')
          .mockReturnValue(new Promise(resolve => resolve(null)));
      });
      it('should not call any methods except getMuzzle', () => {
        muzzleService.sendMuzzledMessage('test', '1234', 'test', 'test');
        expect(mockGetMuzzle).toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(mockTrackDeleted).not.toHaveBeenCalled();
      });
    });
  });
});
