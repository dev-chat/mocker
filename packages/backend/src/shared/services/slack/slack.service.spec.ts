import { vi } from 'vitest';
import { SlackService } from './slack.service';
import * as axios from 'axios';
import type { EventRequest } from '../../models/slack/slack-models';

type SlackServicePrivate = SlackService & {
  web: {
    getAllChannels: Mock;
    getAllUsers: Mock;
  };
  persistenceService: {
    getUserByUserName: Mock;
    getUserById: Mock;
    saveChannels: Mock;
    saveUsers: Mock;
    getCachedUsers: Mock;
    getChannelById: Mock;
    getBotByBotId: Mock;
  };
};

vi.mock('axios');
vi.mock('./slack.persistence.service', async () => ({
  SlackPersistenceService: classMock(() => ({
    getUserByUserName: vi.fn(),
    getUserById: vi.fn(),
    saveChannels: vi.fn(),
    saveUsers: vi.fn(),
    getCachedUsers: vi.fn(),
    getChannelById: vi.fn(),
    getBotByBotId: vi.fn(),
  })),
}));

vi.mock('../web/web.service', async () => ({
  WebService: classMock(() => ({
    getAllChannels: vi.fn(),
    getAllUsers: vi.fn(),
  })),
}));

describe('SlackService', () => {
  let slackService: SlackService;
  let mockWebService: SlackServicePrivate['web'];
  let mockPersistenceService: SlackServicePrivate['persistenceService'];

  beforeEach(() => {
    vi.clearAllMocks();
    slackService = new SlackService();
    const privateService = slackService as unknown as SlackServicePrivate;
    mockWebService = privateService.web;
    mockPersistenceService = privateService.persistenceService;
  });

  describe('getUserId()', () => {
    it('should return a userId when one is passed in without a username', () => {
      expect(slackService.getUserId('<@U2TYNKJ>')).toBe('U2TYNKJ');
    });

    it('should return a userId when one is passed in with a username with spaces', () => {
      expect(slackService.getUserId('<@U2TYNKJ | jrjrjr>')).toBe('U2TYNKJ');
    });

    it('should return a userId when one is passed in with a username without spaces', () => {
      expect(slackService.getUserId('<@U2TYNKJ|jrjrjr>')).toBe('U2TYNKJ');
    });

    it('should return undefined when no userId exists', () => {
      expect(slackService.getUserId('total waste of time')).toBeUndefined();
    });

    it('should return the string when it exists inside of another string', () => {
      expect(slackService.getUserId('Posted by: <@U2YJQN2KB> | Search: test')).toBe('U2YJQN2KB');
    });
  });

  describe('getAllUserIds()', () => {
    it('should return all user IDs when multiple mentions exist', () => {
      expect(slackService.getAllUserIds('<@UALICE> <@UBOB> what do you think?')).toEqual(['UALICE', 'UBOB']);
    });

    it('should return a single user ID when only one mention exists', () => {
      expect(slackService.getAllUserIds('<@U2TYNKJ> hello')).toEqual(['U2TYNKJ']);
    });

    it('should return empty array when no mentions exist', () => {
      expect(slackService.getAllUserIds('no mentions here')).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(slackService.getAllUserIds('')).toEqual([]);
    });

    it('should handle mentions with usernames', () => {
      expect(slackService.getAllUserIds('<@UALICE|alice> <@UBOB|bob>')).toEqual(['UALICE', 'UBOB']);
    });
  });

  describe('isUserMentioned()', () => {
    it('should return true when user is mentioned first', () => {
      expect(slackService.isUserMentioned('<@UMOONBEAM> hello', 'UMOONBEAM')).toBe(true);
    });

    it('should return true when user is mentioned second', () => {
      expect(slackService.isUserMentioned('<@UALICE> <@UMOONBEAM> what do you think?', 'UMOONBEAM')).toBe(true);
    });

    it('should return true when user is mentioned in the middle', () => {
      expect(slackService.isUserMentioned('<@UALICE> <@UMOONBEAM> <@UBOB> thoughts?', 'UMOONBEAM')).toBe(true);
    });

    it('should return false when user is not mentioned', () => {
      expect(slackService.isUserMentioned('<@UALICE> <@UBOB> hello', 'UMOONBEAM')).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(slackService.isUserMentioned('', 'UMOONBEAM')).toBe(false);
    });

    it('should return false when no mentions exist', () => {
      expect(slackService.isUserMentioned('no mentions here', 'UMOONBEAM')).toBe(false);
    });
  });

  describe('containsTag()', () => {
    it('should return false if a word has @ in it and is not a tag', () => {
      const testWord = '.@channel';
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it('should return false if a word does not include @', () => {
      const testWord = 'test';
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it('should return false if no text is passed in', () => {
      expect(slackService.containsTag('')).toBe(false);
    });

    it('should return false if undefined is passed in', () => {
      expect(slackService.containsTag(undefined)).toBe(false);
    });

    it('should return true if a word has <!channel> in it', () => {
      const testWord = '<!channel>';
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it('should return true if a word has <!here> in it', () => {
      const testWord = '<!here>';
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it('should return true if a word has a tagged user', () => {
      const testUser = '<@UTJFJKL>';
      expect(slackService.containsTag(testUser)).toBe(true);
    });
  });

  describe('getUserIdByCallbackId()', () => {
    it('should return a userId when there is one present', () => {
      const callbackId = 'JSLKDJLFJ_U25JKLMN';
      expect(slackService.getUserIdByCallbackId(callbackId)).toBe('U25JKLMN');
    });

    it('should return an empty string when there is no id present', () => {
      const callbackId = 'LJKSDLFJSF';
      expect(slackService.getUserIdByCallbackId(callbackId)).toBe('');
    });

    it('should handle an empty string callbackId', () => {
      expect(slackService.getUserIdByCallbackId('')).toBe('');
    });
  });

  describe('getBotId()', () => {
    describe('it should handle undefined values', () => {
      it('should return an id fromText if it is the only id present', () => {
        expect(slackService.getBotId('12345', undefined, undefined, undefined)).toBe('12345');
      });

      it('should return an id fromAttachmentText if it is the only id present', () => {
        expect(slackService.getBotId(undefined, '12345', undefined, undefined)).toBe('12345');
      });

      it('should return an id fromPretext if it is the only id present', () => {
        expect(slackService.getBotId(undefined, undefined, '12345', undefined)).toBe('12345');
      });

      it('should return an id fromCallBackId if it is the only id present', () => {
        expect(slackService.getBotId(undefined, undefined, undefined, '12345')).toBe('12345');
      });
    });

    describe('it should handle empty strings', () => {
      it('should return an id fromText if it is the only id present', () => {
        expect(slackService.getBotId('12345', '', '', '', '')).toBe('12345');
      });

      it('should return an id fromAttachmentText if it is the only id present', () => {
        expect(slackService.getBotId('', '12345', '', '', '')).toBe('12345');
      });

      it('should return an id fromPretext if it is the only id present', () => {
        expect(slackService.getBotId('', '', '12345', '', '')).toBe('12345');
      });

      it('should return an id fromCallBackId if it is the only id present', () => {
        expect(slackService.getBotId('', '', '', '12345', '')).toBe('12345');
      });
    });

    describe('it should return in the proper order', () => {
      it('should return the first available id - fromText', () => {
        expect(slackService.getBotId('1', '2', '3', '4', '')).toBe('1');
      });

      it('should return the first available id - fromAttachmentText', () => {
        expect(slackService.getBotId(undefined, '2', '3', '4', '')).toBe('2');
      });

      it('should return the first available id - fromPretext', () => {
        expect(slackService.getBotId(undefined, undefined, '3', '4', '')).toBe('3');
      });

      it('should return the first available id - fromCallbackId', () => {
        expect(slackService.getBotId(undefined, undefined, undefined, '4', '')).toBe('4');
      });
    });
  });

  describe('getUserIdByName()', () => {
    it('should return userId for existing user', async () => {
      mockPersistenceService.getUserByUserName.mockResolvedValue({ slackId: 'U123', name: 'alice' });

      const result = await slackService.getUserIdByName('alice', 'T1');

      expect(result).toBe('U123');
      expect(mockPersistenceService.getUserByUserName).toHaveBeenCalledWith('alice', 'T1');
    });

    it('should return undefined when user not found', async () => {
      mockPersistenceService.getUserByUserName.mockResolvedValue(undefined);

      const result = await slackService.getUserIdByName('nonexistent', 'T1');

      expect(result).toBeUndefined();
    });
  });

  describe('getUserNameById()', () => {
    it('should return user name for existing user', async () => {
      mockPersistenceService.getUserById.mockResolvedValue({ slackId: 'U123', name: 'alice' });

      const result = await slackService.getUserNameById('U123', 'T1');

      expect(result).toBe('alice');
      expect(mockPersistenceService.getUserById).toHaveBeenCalledWith('U123', 'T1');
    });

    it('should return undefined when user not found', async () => {
      mockPersistenceService.getUserById.mockResolvedValue(undefined);

      const result = await slackService.getUserNameById('U999', 'T1');

      expect(result).toBeUndefined();
    });
  });

  describe('getChannelName()', () => {
    it('should return channel name for existing channel', async () => {
      mockPersistenceService.getChannelById.mockResolvedValue({ id: 'C123', name: 'general' });

      const result = await slackService.getChannelName('C123', 'T1');

      expect(result).toBe('general');
    });

    it('should return empty string when channel not found', async () => {
      mockPersistenceService.getChannelById.mockResolvedValue(undefined);

      const result = await slackService.getChannelName('C999', 'T1');

      expect(result).toBe('');
    });
  });

  describe('sendResponse()', () => {
    it('should post response to responseUrl', async () => {
      const mockPost = vi.spyOn(axios.default, 'post').mockResolvedValue({ data: { ok: true } });

      slackService.sendResponse('https://hooks.slack.com/test', { response_type: 'in_channel', text: 'test' });

      await Promise.resolve();
      expect(mockPost).toHaveBeenCalledWith('https://hooks.slack.com/test', {
        response_type: 'in_channel',
        text: 'test',
      });
    });

    it('should handle errors silently', async () => {
      const mockPost = vi.spyOn(axios.default, 'post').mockRejectedValue(new Error('Network error'));
      const loggerSpy = vi.spyOn(slackService.logger, 'error');

      slackService.sendResponse('https://hooks.slack.com/test', { response_type: 'in_channel', text: 'test' });

      const postPromise = mockPost.mock.results[0]?.value as Promise<unknown>;
      await postPromise.catch(() => undefined);
      expect(mockPost).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to post Slack response URL callback',
        expect.objectContaining({
          context: expect.objectContaining({
            responseUrl: 'https://hooks.slack.com/test',
            responseType: 'in_channel',
            responseText: 'test',
          }),
          error: expect.objectContaining({ message: 'Network error', name: 'Error' }),
        }),
      );
    });
  });

  describe('getImpersonatedUser()', () => {
    it('should find user with same display name', async () => {
      const impersonator = { id: 'U123', profile: { display_name: 'alice', real_name: 'Alice Smith' } };
      const victim = { id: 'U456', profile: { display_name: 'alice', real_name: 'Alice Jones' } };
      mockWebService.getAllUsers.mockResolvedValue({
        members: [impersonator, victim],
      });

      const result = await slackService.getImpersonatedUser('U123');

      expect(result).toEqual(victim);
    });

    it('should find user with same real name', async () => {
      const impersonator = { id: 'U123', profile: { display_name: 'alice_display', real_name: 'Alice Smith' } };
      const victim = { id: 'U456', profile: { display_name: 'bob_display', real_name: 'Alice Smith' } };
      mockWebService.getAllUsers.mockResolvedValue({
        members: [impersonator, victim],
      });

      const result = await slackService.getImpersonatedUser('U123');

      expect(result).toEqual(victim);
    });

    it('should not return same user', async () => {
      const user = { id: 'U123', profile: { display_name: 'alice', real_name: 'Alice' } };
      mockWebService.getAllUsers.mockResolvedValue({
        members: [user],
      });

      const result = await slackService.getImpersonatedUser('U123');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no matching user found', async () => {
      const user = { id: 'U123', profile: { display_name: 'alice', real_name: 'Alice' } };
      mockWebService.getAllUsers.mockResolvedValue({
        members: [user],
      });

      const result = await slackService.getImpersonatedUser('U999');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllUsers()', () => {
    it('should return cached users if available', async () => {
      const cachedUsers = [{ slackId: 'U123', name: 'alice' }];
      mockPersistenceService.getCachedUsers.mockResolvedValue(cachedUsers);

      const result = await slackService.getAllUsers();

      expect(result).toEqual(cachedUsers);
      expect(mockWebService.getAllUsers).not.toHaveBeenCalled();
    });

    it('should fetch and save users if not cached', async () => {
      const webUsers = [{ id: 'U123', name: 'alice' }];
      const savedUsers = [{ slackId: 'U123', name: 'alice' }];
      mockPersistenceService.getCachedUsers.mockResolvedValue(null);
      mockWebService.getAllUsers.mockResolvedValue({ members: webUsers });
      mockPersistenceService.saveUsers.mockResolvedValue(savedUsers);

      const result = await slackService.getAllUsers();

      expect(result).toEqual(savedUsers);
      expect(mockWebService.getAllUsers).toHaveBeenCalled();
      expect(mockPersistenceService.saveUsers).toHaveBeenCalledWith(webUsers);
    });

    it('should retry on web fetch error', async () => {
      vi.useFakeTimers();
      mockPersistenceService.getCachedUsers.mockResolvedValue(null);
      mockWebService.getAllUsers.mockRejectedValue(new Error('API Error'));
      const loggerSpy = vi.spyOn(slackService.logger, 'error');

      const promise = slackService.getAllUsers();

      await expect(promise).rejects.toThrow('Unable to retrieve users');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to retrieve users',
        expect.objectContaining({
          error: expect.objectContaining({ message: 'API Error', name: 'Error' }),
        }),
      );

      vi.useRealTimers();
    });

    it('should handle save error', async () => {
      const webUsers = [{ id: 'U123', name: 'alice' }];
      mockPersistenceService.getCachedUsers.mockResolvedValue(null);
      mockWebService.getAllUsers.mockResolvedValue({ members: webUsers });
      mockPersistenceService.saveUsers.mockRejectedValue(new Error('DB Error'));

      await expect(slackService.getAllUsers()).rejects.toThrow('DB Error');
    });
  });

  describe('getBotByBotId()', () => {
    it('should return bot from persistence service', async () => {
      const mockBot = { slackId: 'B123', name: 'test_bot' };
      mockPersistenceService.getBotByBotId.mockResolvedValue(mockBot);

      const result = await slackService.getBotByBotId('B123', 'T1');

      expect(result).toEqual(mockBot);
      expect(mockPersistenceService.getBotByBotId).toHaveBeenCalledWith('B123', 'T1');
    });

    it('should return null when bot not found', async () => {
      mockPersistenceService.getBotByBotId.mockResolvedValue(null);

      const result = await slackService.getBotByBotId('B999', 'T1');

      expect(result).toBeNull();
    });
  });

  describe('getUserById()', () => {
    it('should return user from persistence service', async () => {
      const mockUser = { slackId: 'U123', name: 'alice' };
      mockPersistenceService.getUserById.mockResolvedValue(mockUser);

      const result = await slackService.getUserById('U123', 'T1');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPersistenceService.getUserById.mockResolvedValue(null);

      const result = await slackService.getUserById('U999', 'T1');

      expect(result).toBeNull();
    });
  });

  describe('handle()', () => {
    it('should call getAllUsers on team_join event', async () => {
      const getAllUsersSpy = vi.spyOn(slackService, 'getAllUsers').mockResolvedValue([]);

      slackService.handle({
        event: { type: 'team_join', user: { id: 'U123' } },
      } as unknown as EventRequest);

      await Promise.resolve();
      expect(getAllUsersSpy).toHaveBeenCalled();
    });

    it('should call getAndSaveAllChannels on channel_created event', () => {
      const getAndSaveChannelsSpy = vi.spyOn(slackService, 'getAndSaveAllChannels').mockImplementation(() => undefined);

      slackService.handle({
        event: { type: 'channel_created', channel: { id: 'C123' } },
      } as unknown as EventRequest);

      expect(getAndSaveChannelsSpy).toHaveBeenCalled();
    });

    it('should do nothing for other event types', () => {
      const getAllUsersSpy = vi.spyOn(slackService, 'getAllUsers');
      const getAndSaveChannelsSpy = vi.spyOn(slackService, 'getAndSaveAllChannels');

      slackService.handle({
        event: { type: 'app_mention', text: 'test' },
      } as unknown as EventRequest);

      expect(getAllUsersSpy).not.toHaveBeenCalled();
      expect(getAndSaveChannelsSpy).not.toHaveBeenCalled();
    });

    it('should handle getAllUsers error gracefully', async () => {
      vi.spyOn(slackService, 'getAllUsers').mockRejectedValue(new Error('API Error'));
      const loggerSpy = vi.spyOn(slackService.logger, 'error');

      slackService.handle({
        event: { type: 'team_join', user: { id: 'U123' } },
      } as unknown as EventRequest);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error handling team join event',
        expect.objectContaining({
          context: expect.objectContaining({ eventType: 'team_join' }),
          error: expect.objectContaining({ message: 'API Error', name: 'Error' }),
        }),
      );
    });
  });

  describe('getAndSaveAllChannels()', () => {
    it('should fetch and save all channels', (done) => {
      const channels = [{ id: 'C1', name: 'general' }];
      mockWebService.getAllChannels.mockResolvedValue({ channels });

      slackService.getAndSaveAllChannels();

      setTimeout(() => {
        expect(mockPersistenceService.saveChannels).toHaveBeenCalledWith(channels);
        done();
      }, 50);
    });
  });
});
