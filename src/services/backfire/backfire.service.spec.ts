import { TranslationService } from '../../shared/services/translation.service';
import { CounterPersistenceService } from '../counter/counter.persistence.service';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { SlackService } from '../slack/slack.service';
import { WebService } from '../web/web.service';
import { BackfirePersistenceService } from './backfire.persistence.service';
import { BackfireService } from './backfire.service';

describe('BackfireService', () => {
  let backfireService: BackfireService;

  beforeEach(() => {
    const mockWebService = {
      deleteMessage: jest.fn(),
    } as Partial<WebService>;
    const mockSlackService = {} as SlackService;
    const mockTranslationService = {} as TranslationService;
    const mockBackfirePersistenceService = {
      addBackfireTime: jest.fn(),
      getBackfireByUserId: jest.fn(),
      getSuppressions: jest.fn(),
      addSuppression: jest.fn(),
      trackDeletedMessage: jest.fn(),
    } as Partial<BackfirePersistenceService>;
    const mockMuzzlePersistenceService = {} as MuzzlePersistenceService;
    const mockCounterPersistenceService = {} as CounterPersistenceService;

    backfireService = new BackfireService(
      mockWebService as unknown as WebService,
      mockSlackService,
      mockTranslationService,
      mockBackfirePersistenceService as unknown as BackfirePersistenceService,
      mockMuzzlePersistenceService as unknown as MuzzlePersistenceService,
      mockCounterPersistenceService as unknown as CounterPersistenceService,
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  it('should create', () => {
    expect(backfireService).toBeTruthy();
  });

  describe('addBackfireTime', () => {
    it('should call addBackfireTime', () => {
      backfireService.addBackfireTime('userId', 'teamId', 1000);
      expect(backfireService.backfirePersistenceService.addBackfireTime).toHaveBeenCalledWith('userId', 'teamId', 1000);
    });
  });

  describe('sendBackfiredMessage', () => {
    it('should call sendBackfiredMessage', async () => {
      const channel = 'channel';
      const userId = 'userId';
      const text = 'text';
      const timestamp = 'timestamp';
      const teamId = 'teamId';
      const backfireId = 1;
      const suppressions = 0;
      backfireService.backfirePersistenceService.getBackfireByUserId = jest.fn().mockResolvedValue(backfireId);
      backfireService.backfirePersistenceService.getSuppressions = jest.fn().mockResolvedValue(suppressions);

      await backfireService.sendBackfiredMessage(channel, userId, text, timestamp, teamId);
      expect(backfireService.backfirePersistenceService.getBackfireByUserId).toHaveBeenCalledWith(userId, teamId);
      expect(backfireService.backfirePersistenceService.getSuppressions).toHaveBeenCalledWith(userId, teamId);
      expect(backfireService.backfirePersistenceService.addSuppression).toHaveBeenCalledWith(userId, teamId);
      expect(backfireService.webService.deleteMessage).toHaveBeenCalledWith(channel, timestamp, userId);
      expect(backfireService.backfirePersistenceService.trackDeletedMessage).not.toHaveBeenCalled();
    });

    it('should call sendBackfiredMessage and trackDeletedMessage', async () => {
      const channel = 'channel';
      const userId = 'userId';
      const text = 'text';
      const timestamp = 'timestamp';
      const teamId = 'teamId';
      const backfireId = 1;
      const suppressions = 3;
      backfireService.backfirePersistenceService.getBackfireByUserId = jest.fn().mockResolvedValue(backfireId);
      backfireService.backfirePersistenceService.getSuppressions = jest.fn().mockResolvedValue(suppressions);

      await backfireService.sendBackfiredMessage(channel, userId, text, timestamp, teamId);
      expect(backfireService.backfirePersistenceService.getBackfireByUserId).toHaveBeenCalledWith(userId, teamId);
      expect(backfireService.backfirePersistenceService.getSuppressions).toHaveBeenCalledWith(userId, teamId);
      expect(backfireService.backfirePersistenceService.addSuppression).not.toHaveBeenCalled();
      expect(backfireService.webService.deleteMessage).not.toHaveBeenCalled();
      expect(backfireService.backfirePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(backfireId, text);
    });
  });
});
