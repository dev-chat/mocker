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
    muzzleService.counterService = {
      removeCounter: jest.fn(),
    } as never;
    muzzleService.storePersistenceService = {
      isProtected: jest.fn().mockResolvedValue(undefined),
      getTimeModifiers: jest.fn().mockResolvedValue(0),
      getUserOfUsedItem: jest.fn(),
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
        new Error('Sorry, you cannot muzzle bots.'),
      );
    });

    it('rejects if the user is already muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValueOnce(true);

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        new Error('TestUser is already muzzled!'),
      );
    });

    it('rejects if requested user is empty', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);

      await expect(muzzleService.addUserToMuzzled('', 'requestor123', 'team123', 'channel123')).rejects.toThrow(
        'Invalid username',
      );
    });

    it('rejects if requestor is muzzled', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        new Error(`You can't muzzle someone if you are already muzzled!`),
      );
    });

    it('rejects if user has been countered', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(123);
      jest.spyOn(muzzleService.counterService, 'removeCounter');

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        new Error(`You've been countered! Better luck next time...`),
      );

      expect(muzzleService.counterService.removeCounter).toHaveBeenCalledWith(
        123,
        true,
        'user123',
        'requestor123',
        'channel123',
        'team123',
      );
    });

    it('handles backfire scenario', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(true);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      muzzleService.backfirePersistenceService.addBackfire.mockResolvedValue({ id: 1 });
      mockMuzzlePersistenceService.setRequestorCount.mockResolvedValue(void 0);

      const result = await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');

      expect(result).toContain('Backfired');
      expect(muzzleService.webService.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.stringContaining('backfired'),
      );
    });

    it('logs error if backfire announcement fails', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(true);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      muzzleService.backfirePersistenceService.addBackfire.mockResolvedValue({ id: 1 });
      muzzleService.webService.sendMessage = jest.fn().mockRejectedValue(new Error('announce fail')) as never;
      const loggerSpy = jest.spyOn(muzzleService.logger, 'error');

      await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('rejects when addBackfire fails', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(true);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      muzzleService.backfirePersistenceService.addBackfire.mockRejectedValue(new Error('backfire fail'));

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        new Error('Muzzle failed!'),
      );
    });

    it('handles protected user scenario', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.isProtected.mockResolvedValue('guardian.123');
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      muzzleService.storePersistenceService.getUserOfUsedItem.mockResolvedValue('protector-U999');
      mockMuzzlePersistenceService.setRequestorCount.mockResolvedValue(void 0);
      mockMuzzlePersistenceService.addMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');

      expect(result).toContain('Light shines');
      expect(muzzleService.webService.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.stringContaining('protected'),
      );
    });

    it('logs when protected-user announcement fails', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.isProtected.mockResolvedValue('guardian.123');
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      muzzleService.storePersistenceService.getUserOfUsedItem.mockResolvedValue('protector-U999');
      muzzleService.webService.sendMessage = jest.fn().mockRejectedValue(new Error('send fail')) as never;
      mockMuzzlePersistenceService.addMuzzle.mockResolvedValue({ id: 1 });
      const loggerSpy = jest.spyOn(muzzleService.logger, 'error');

      await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('rejects if max muzzles reached', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.isProtected.mockResolvedValue(undefined);
      mockMuzzlePersistenceService.isMaxMuzzlesReached.mockResolvedValue(true);

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toThrow(
        'doing that too much',
      );
    });

    it('successfully muzzles user when all checks pass', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.isProtected.mockResolvedValue(undefined);
      mockMuzzlePersistenceService.isMaxMuzzlesReached.mockResolvedValue(false);
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      mockMuzzlePersistenceService.addMuzzle.mockResolvedValue({ id: 1 });

      const result = await muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123');

      expect(result).toContain('Successfully muzzled');
      expect(mockMuzzlePersistenceService.addMuzzle).toHaveBeenCalled();
    });

    it('rejects when addMuzzle fails', async () => {
      mockSlackService.getUserNameById.mockResolvedValue('TestUser');
      jest.spyOn(muzzleService, 'isBot').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'isSuppressed').mockResolvedValue(false);
      jest.spyOn(muzzleService, 'shouldBackfire').mockResolvedValue(false);
      muzzleService.counterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      muzzleService.storePersistenceService.isProtected.mockResolvedValue(undefined);
      mockMuzzlePersistenceService.isMaxMuzzlesReached.mockResolvedValue(false);
      muzzleService.storePersistenceService.getTimeModifiers.mockResolvedValue(0);
      mockMuzzlePersistenceService.addMuzzle.mockRejectedValue(new Error('DB Error'));

      await expect(muzzleService.addUserToMuzzled('user123', 'requestor123', 'team123', 'channel123')).rejects.toEqual(
        new Error('Muzzle failed!'),
      );
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

    it('handles getMuzzle errors gracefully', async () => {
      const loggerSpy = jest.spyOn(muzzleService.logger, 'error');
      mockMuzzlePersistenceService.getMuzzle.mockRejectedValue(new Error('db error'));

      await muzzleService.sendMuzzledMessage('channel123', 'user123', 'team123', 'test message', 'timestamp123');

      expect(loggerSpy).toHaveBeenCalledWith('error retrieving muzzle', expect.any(Error));
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

    it('logs if broadcast after perma-muzzle fails', async () => {
      mockSlackService.getImpersonatedUser.mockResolvedValue({ id: 'victim123' });
      mockMuzzlePersistenceService.addPermaMuzzle.mockResolvedValue({ id: 1 });
      muzzleService.webService.sendMessage = jest.fn().mockRejectedValue(new Error('send failed')) as never;
      const loggerSpy = jest.spyOn(muzzleService.logger, 'error');

      await muzzleService.handleImpersonation({
        event: { type: 'user_profile_changed', user: { id: 'user123' } },
        team_id: 'team123',
      } as never);
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
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

    it('adds penalty and announces when muzzled user tags', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(true);
      mockSlackService.containsTag.mockReturnValue(true);
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(123);

      await muzzleService.handle({
        event: {
          type: 'message',
          subtype: 'channel_topic',
          user: 'user123',
          text: '<!channel> test',
          channel: 'channel123',
          ts: 'timestamp123',
        },
        team_id: 'team123',
      } as never);

      expect(mockMuzzlePersistenceService.addMuzzleTime).toHaveBeenCalled();
      expect(mockMuzzlePersistenceService.trackDeletedMessage).toHaveBeenCalledWith(123, '<!channel> test');
      expect(muzzleService.webService.sendMessage).toHaveBeenCalled();
    });

    it('logs if tagged-user warning message fails', async () => {
      mockMuzzlePersistenceService.isUserMuzzled.mockResolvedValue(true);
      mockSlackService.containsTag.mockReturnValue(true);
      mockMuzzlePersistenceService.getMuzzle.mockResolvedValue(123);
      muzzleService.webService.sendMessage = jest.fn().mockRejectedValue(new Error('send fail')) as never;
      const loggerSpy = jest.spyOn(muzzleService.logger, 'error');

      await muzzleService.handle({
        event: {
          type: 'message',
          subtype: 'channel_topic',
          user: 'user123',
          text: '<!channel> test',
          channel: 'channel123',
          ts: 'timestamp123',
        },
        team_id: 'team123',
      } as never);
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
