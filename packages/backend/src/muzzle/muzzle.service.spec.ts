import { MuzzleService } from './muzzle.service';

describe('MuzzleService', () => {
  let muzzleService: MuzzleService;
  let mockMuzzlePersistenceService: Record<string, jest.Mock>;
  let mockSlackService: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();

    muzzleService = new MuzzleService();

    mockMuzzlePersistenceService = {
      addPermaMuzzle: jest.fn(),
      removePermaMuzzle: jest.fn(),
      isUserMuzzled: jest.fn(),
      addMuzzle: jest.fn(),
      getMuzzle: jest.fn().mockResolvedValue(undefined),
      getSuppressions: jest.fn().mockResolvedValue(null),
      incrementStatefulSuppressions: jest.fn(),
      trackDeletedMessage: jest.fn(),
      isMaxMuzzlesReached: jest.fn().mockResolvedValue(false),
      setRequestorCount: jest.fn(),
      addMuzzleTime: jest.fn(),
    };

    mockSlackService = {
      getUserNameById: jest.fn(),
      getUserById: jest.fn(),
      getImpersonatedUser: jest.fn(),
      containsTag: jest.fn().mockReturnValue(false),
    };

    muzzleService.muzzlePersistenceService = mockMuzzlePersistenceService as never;
    muzzleService.slackService = mockSlackService as never;
    muzzleService.counterPersistenceService = {
      getCounterByRequestorId: jest.fn().mockReturnValue(undefined),
    } as never;
    muzzleService.storePersistenceService = {
      isProtected: jest.fn().mockResolvedValue(undefined),
      getTimeModifiers: jest.fn().mockResolvedValue(0),
    } as never;
    muzzleService.backfirePersistenceService = {
      addBackfire: jest.fn().mockResolvedValue({ id: 1 }),
    } as never;
    muzzleService.webService = {
      deleteMessage: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
    } as never;

    jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
    jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
    jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
    jest.spyOn(muzzleService, 'sendSuppressedMessage').mockImplementation(async () => undefined);
  });

  describe('permaMuzzle', () => {
    it('calls addPermaMuzzle on the persistence service', async () => {
      mockMuzzlePersistenceService.addPermaMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.permaMuzzle('user123', 'team123');

      expect(mockMuzzlePersistenceService.addPermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('removePermaMuzzle', () => {
    it('calls removePermaMuzzle on the persistence service', async () => {
      mockMuzzlePersistenceService.removePermaMuzzle.mockResolvedValue(true);

      const result = await muzzleService.removePermaMuzzle('user123', 'team123');

      expect(mockMuzzlePersistenceService.removePermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
      expect(result).toBe(true);
    });
  });

  describe('addUserToMuzzled', () => {
    it('rejects if the user is a bot', async () => {
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(true);
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        'Sorry, you cannot muzzle bots.',
      );
    });

    it('rejects if the user is already muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValueOnce(true);

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        'TestUser is already muzzled!',
      );
    });

    it('resolves when user is successfully muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      mockMuzzlePersistenceService.addMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');

      expect(mockMuzzlePersistenceService.addMuzzle).toHaveBeenCalled();
      expect(result).toContain('Successfully muzzled TestUser');
    });
  });

  describe('sendMuzzledMessage', () => {
    it('sends a suppressed message if suppressions are below the max', async () => {
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(1);
      mockMuzzlePersistenceService.getSuppressions.mockResolvedValue('2');

      await muzzleService.sendMuzzledMessage('channel123', 'user123', 'team123', 'test message', 'timestamp123');

      expect(mockMuzzlePersistenceService.incrementStatefulSuppressions).toHaveBeenCalledWith('user123', 'team123');
      expect(muzzleService.sendSuppressedMessage).toHaveBeenCalled();
    });

    it('tracks deleted messages if suppressions are at the max', async () => {
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(1);
      mockMuzzlePersistenceService.getSuppressions.mockResolvedValue('7');

      await muzzleService.sendMuzzledMessage('channel123', 'user123', 'team123', 'test message', 'timestamp123');

      expect(mockMuzzlePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(1, 'test message');
    });
  });

  describe('handleImpersonation', () => {
    it('perma-muzzles a user if they are impersonating someone', async () => {
      mockSlackService.getImpersonatedUser.mockResolvedValue({ id: 'victim123' });
      mockMuzzlePersistenceService.addPermaMuzzle.mockResolvedValue({ id: 1 });

      await muzzleService.handleImpersonation({
        event: { type: 'user_profile_changed', user: { id: 'user123' } },
        team_id: 'team123',
      } as never);

      expect(mockMuzzlePersistenceService.addPermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });

    it('removes perma-muzzle if user is not impersonating', async () => {
      mockSlackService.getImpersonatedUser.mockResolvedValue(null);

      await muzzleService.handleImpersonation({
        event: { type: 'user_profile_changed', user: { id: 'user123' } },
        team_id: 'team123',
      } as never);

      expect(mockMuzzlePersistenceService.removePermaMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });
  });

  describe('handle', () => {
    it('deletes a message and sends a muzzled message if user is muzzled', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(true);

      await muzzleService.handle({
        event: { type: 'message', user: 'user123', text: 'test message', channel: 'channel123', ts: 'timestamp123' },
        team_id: 'team123',
      } as never);

      expect(muzzleService.webService.deleteMessage).toHaveBeenCalledWith('channel123', 'timestamp123', 'user123');
      expect(mockMuzzlePersistenceService.getMuzzle).toHaveBeenCalledWith('user123', 'team123');
    });

    it('does not delete a message if user is not muzzled', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(false);

      await muzzleService.handle({
        event: { type: 'message', user: 'user123', text: 'test message', channel: 'channel123', ts: 'timestamp123' },
        team_id: 'team123',
      } as never);

      expect(muzzleService.webService.deleteMessage).not.toHaveBeenCalled();
    });
  });
});
