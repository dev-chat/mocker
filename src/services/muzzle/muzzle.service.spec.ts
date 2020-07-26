/* eslint-disable @typescript-eslint/camelcase */
import { when } from 'jest-when';
import { Muzzle } from '../../shared/db/models/Muzzle';
import { WebService } from '../web/web.service';
import { MAX_SUPPRESSIONS } from './constants';
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

  beforeEach(() => {
    muzzleService = new MuzzleService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
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
      let mockIncrementMessageSuppressions: jest.SpyInstance;
      let mockIncrementCharacterSuppressions: jest.SpyInstance;
      let mockIncrementWordSuppressions: jest.SpyInstance;

      beforeEach(() => {
        jest.clearAllMocks();
        mockMuzzle = '1234';
        mockDeleteMessage = jest.spyOn(webService, 'deleteMessage');
        mockSendMessage = jest.spyOn(webService, 'sendMessage').mockImplementation(() => true);
        mockTrackDeleted = jest.spyOn(persistenceService, 'trackDeletedMessage').mockImplementation(() => jest.fn());
        mockGetSuppressions = jest.spyOn(persistenceService, 'getSuppressions');
        mockGetMuzzle = jest.spyOn(persistenceService, 'getMuzzle').mockResolvedValue(mockMuzzle);
        mockIncrementMessageSuppressions = jest.spyOn(persistenceService, 'incrementMessageSuppressions');
        mockIncrementWordSuppressions = jest.spyOn(persistenceService, 'incrementWordSuppressions');
        mockIncrementCharacterSuppressions = jest.spyOn(persistenceService, 'incrementCharacterSuppressions');
      });

      it('should call getMuzzle, deleteMessage and sendMessage if suppressionCount is 0', async () => {
        mockGetSuppressions.mockResolvedValue('0');
        mockGetMuzzle.mockResolvedValue('1234');
        mockIncrementMessageSuppressions.mockImplementation(() => jest.fn());
        mockIncrementCharacterSuppressions.mockImplementation(() => jest.fn());
        mockIncrementWordSuppressions.mockImplementation(() => jest.fn());
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

        mockGetMuzzle = jest
          .spyOn(persistenceService, 'getMuzzle')
          .mockReturnValue(new Promise(resolve => resolve(null)));

        mockTrackDeleted = jest.spyOn(persistenceService, 'trackDeletedMessage').mockImplementation(() => jest.fn());
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
