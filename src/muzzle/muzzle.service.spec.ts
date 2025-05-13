import { mockSuppressorService } from '../shared/mocks/suppressor.service.mock';
import { SlackService } from '../shared/services/slack/slack.service';

jest.mock('../shared/services/suppressor.service');

import { MuzzleService } from './muzzle.service';

describe('MuzzleService', () => {
  let muzzleService: MuzzleService;
  let mockMuzzlePersistenceService: unknown;
  let mockSlackService: SlackService;

  beforeEach(() => {
    muzzleService = new MuzzleService();
    mockMuzzlePersistenceService = muzzleService.muzzlePersistenceService;
    mockSlackService = muzzleService.slackService;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.clearAllMocks();
  });

  describe('permaMuzzle', () => {
    it('should call addPermaMuzzle on the persistence service', async () => {
      mockMuzzlePersistenceService.addPermaMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.permaMuzzle('user123', 'team123');

      expect(mockMuzzlePersistenceService.addPermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('removePermaMuzzle', () => {
    it('should call removePermaMuzzle on the persistence service', async () => {
      mockMuzzlePersistenceService.removePermaMuzzle.mockResolvedValue(true);

      const result = await muzzleService.removePermaMuzzle('user123', 'team123');

      expect(mockMuzzlePersistenceService.removePermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
      expect(result).toBe(true);
    });
  });

  describe('addUserToMuzzled', () => {
    it('should reject if the user is a bot', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      mockSlackService.getUserNameById.mockResolvedValue('Requestor');
      mockSlackService.getUserById.mockResolvedValue({ isBot: true });

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        'Sorry, you cannot muzzle bots.',
      );
    });

    it('should reject if the user is already muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      mockSlackService.getUserNameById.mockResolvedValue('Requestor');
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(true);

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        'TestUser is already muzzled!',
      );
    });

    it('should resolve if the user is successfully muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      mockSlackService.getUserNameById.mockResolvedValue('Requestor');
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(false);
      mockMuzzlePersistenceService.addMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');

      expect(result).toContain('Successfully muzzled TestUser');
    });
  });

  describe('sendMuzzledMessage', () => {
    it('should send a suppressed message if suppressions are below the max', async () => {
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(1);
      mockMuzzlePersistenceService.getSuppressions.mockResolvedValue('2');

      await muzzleService.sendMuzzledMessage('channel123', 'user123', 'team123', 'test message', 'timestamp123');

      expect(mockMuzzlePersistenceService.incrementStatefulSuppressions).toHaveBeenCalledWith('user123', 'team123');
    });

    it('should track deleted messages if suppressions are at the max', async () => {
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(1);
      mockMuzzlePersistenceService.getSuppressions.mockResolvedValue('5'); // Assuming max suppressions is 5

      await muzzleService.sendMuzzledMessage('channel123', 'user123', 'team123', 'test message', 'timestamp123');

      expect(mockMuzzlePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(1, 'test message');
    });
  });

  describe('handleImpersonation', () => {
    it('should perma-muzzle a user if they are impersonating someone', async () => {
      mockSlackService.getImpersonatedUser.mockResolvedValue({ id: 'impersonatedUser123' });

      const request = {
        event: { type: 'user_profile_changed', user: 'user123' },
        team_id: 'team123',
      };

      await muzzleService.handleImpersonation(request);

      expect(mockMuzzlePersistenceService.addPermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });

    it('should remove perma-muzzle if the user is not impersonating', async () => {
      mockSlackService.getImpersonatedUser.mockResolvedValue(null);

      const request = {
        event: { type: 'user_profile_changed', user: 'user123' },
        team_id: 'team123',
      };

      await muzzleService.handleImpersonation(request);

      expect(mockMuzzlePersistenceService.removePermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('handle', () => {
    it('should delete a message and send a muzzled message if the user is muzzled', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(true);

      const request = {
        event: { type: 'message', user: 'user123', text: 'test message', channel: 'channel123', ts: 'timestamp123' },
        team_id: 'team123',
      };

      await muzzleService.handle(request);

      expect(mockSuppressorService.webService.deleteMessage).toHaveBeenCalledWith(
        'channel123',
        'timestamp123',
        'user123',
      );
      expect(mockMuzzlePersistenceService.getMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });

    it('should not delete a message if the user is not muzzled', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(false);

      const request = {
        event: { type: 'message', user: 'user123', text: 'test message', channel: 'channel123', ts: 'timestamp123' },
        team_id: 'team123',
      };

      await muzzleService.handle(request);

      expect(mockSuppressorService.webService.deleteMessage).not.toHaveBeenCalled();
    });
  });
});
