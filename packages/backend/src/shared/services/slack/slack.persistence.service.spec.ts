import { getRepository } from 'typeorm';
import { SlackPersistenceService } from './slack.persistence.service';
import { SlackChannel } from '../../../shared/db/models/SlackChannel';
import { SlackUser } from '../../../shared/db/models/SlackUser';
import type {
  SlackChannel as SlackChannelResponse,
  SlackUser as SlackUserResponse,
} from '../../../shared/models/slack/slack-models';

type SlackPersistenceDependencies = SlackPersistenceService & {
  redis: typeof redis;
};

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('SlackPersistenceService', () => {
  let service: SlackPersistenceService;

  const channelRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const redis = {
    getValue: jest.fn(),
    setValueWithExpire: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SlackPersistenceService();
    (service as unknown as SlackPersistenceDependencies).redis = redis;

    (getRepository as jest.Mock).mockImplementation((model: unknown) => {
      if (model === SlackChannel) {
        return channelRepo;
      }
      if (model === SlackUser) {
        return userRepo;
      }
      return {};
    });
  });

  it('saveChannels returns when channels are missing', async () => {
    await expect(service.saveChannels(undefined)).resolves.toBeUndefined();
    expect(channelRepo.findOne).not.toHaveBeenCalled();
  });

  it('saveChannels updates existing and inserts new channels', async () => {
    channelRepo.findOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);

    await service.saveChannels([
      { id: 'C1', name: 'general', shared_team_ids: ['T1'] } as unknown as SlackChannelResponse,
      { id: 'C2', name: 'random', shared_team_ids: ['T1'] } as unknown as SlackChannelResponse,
    ]);

    expect(channelRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ channelId: 'C1', name: 'general', teamId: 'T1' }),
    );
    expect(channelRepo.save).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'C2', name: 'random' }));
  });

  it('getCachedUsers returns parsed users when cache is present', async () => {
    redis.getValue.mockResolvedValue(JSON.stringify([{ slackId: 'U1' }]));

    await expect(service.getCachedUsers()).resolves.toEqual([{ slackId: 'U1' }]);
  });

  it('getCachedUsers returns null for empty cache', async () => {
    redis.getValue.mockResolvedValue(null);

    await expect(service.getCachedUsers()).resolves.toBeNull();
  });

  it('saveUsers caches users and updates/inserts db users', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 1, slackId: 'U1', teamId: 'T1' }).mockResolvedValueOnce(null);
    userRepo.save.mockResolvedValue({ id: 1 });

    const out = await service.saveUsers([
      {
        id: 'U1',
        name: 'alice',
        team_id: 'T1',
        profile: { display_name: 'Alice', bot_id: '' },
        is_bot: false,
      } as unknown as SlackUserResponse,
      {
        id: 'U2',
        name: 'bot',
        team_id: 'T1',
        profile: { display_name: '', bot_id: 'B2' },
        is_bot: true,
      } as unknown as SlackUserResponse,
    ]);

    expect(redis.setValueWithExpire).toHaveBeenCalledWith('team', expect.any(String), 'PX', 60000);
    expect(userRepo.save).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(expect.objectContaining({ slackId: 'U1', name: 'Alice', isBot: false }));
    expect(out[1]).toEqual(expect.objectContaining({ slackId: 'U2', botId: 'B2', isBot: true }));
  });

  it('saveUsers throws when caching fails', async () => {
    redis.setValueWithExpire.mockRejectedValue(new Error('redis down'));

    await expect(
      service.saveUsers([
        { id: 'U1', name: 'alice', team_id: 'T1', profile: { display_name: '' } } as unknown as SlackUserResponse,
      ]),
    ).rejects.toThrow('redis down');
  });

  it('fetches user, bot and channel records by id', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1 });
    channelRepo.findOne.mockResolvedValue({ id: 2 });

    await expect(service.getUserById('U1', 'T1')).resolves.toEqual({ id: 1 });
    await expect(service.getUserByUserName('alice', 'T1')).resolves.toEqual({ id: 1 });
    await expect(service.getBotByBotId('B1', 'T1')).resolves.toEqual({ id: 1 });
    await expect(service.getChannelById('C1', 'T1')).resolves.toEqual({ id: 2 });
  });

  describe('getCustomPrompt', () => {
    it('returns the custom prompt when user exists and has one set', async () => {
      userRepo.findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', customPrompt: 'respond like a pirate' });

      await expect(service.getCustomPrompt('U1', 'T1')).resolves.toBe('respond like a pirate');
    });

    it('returns null when user exists but has no custom prompt', async () => {
      userRepo.findOne.mockResolvedValue({ slackId: 'U1', teamId: 'T1', customPrompt: null });

      await expect(service.getCustomPrompt('U1', 'T1')).resolves.toBeNull();
    });

    it('returns null when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getCustomPrompt('U1', 'T1')).resolves.toBeNull();
    });

    it('returns null when repository throws', async () => {
      userRepo.findOne.mockRejectedValue(new Error('db error'));

      await expect(service.getCustomPrompt('U1', 'T1')).resolves.toBeNull();
    });
  });

  describe('setCustomPrompt', () => {
    it('saves the trimmed custom prompt and returns true when user exists', async () => {
      userRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.setCustomPrompt('U1', 'T1', '  my custom prompt  ')).resolves.toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith(
        { slackId: 'U1', teamId: 'T1' },
        { customPrompt: 'my custom prompt' },
      );
    });

    it('stores null when prompt is whitespace-only', async () => {
      userRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.setCustomPrompt('U1', 'T1', '   ')).resolves.toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith({ slackId: 'U1', teamId: 'T1' }, { customPrompt: null });
    });

    it('returns false when user is not found', async () => {
      userRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.setCustomPrompt('U1', 'T1', 'my prompt')).resolves.toBe(false);
    });

    it('returns false when repository throws', async () => {
      userRepo.update.mockRejectedValue(new Error('db error'));

      await expect(service.setCustomPrompt('U1', 'T1', 'my prompt')).resolves.toBe(false);
    });
  });

  describe('clearCustomPrompt', () => {
    it('clears the custom prompt and returns true when user exists', async () => {
      userRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.clearCustomPrompt('U1', 'T1')).resolves.toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith({ slackId: 'U1', teamId: 'T1' }, { customPrompt: null });
    });

    it('returns false when user is not found', async () => {
      userRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.clearCustomPrompt('U1', 'T1')).resolves.toBe(false);
    });

    it('returns false when repository throws', async () => {
      userRepo.update.mockRejectedValue(new Error('db error'));

      await expect(service.clearCustomPrompt('U1', 'T1')).resolves.toBe(false);
    });
  });
});
