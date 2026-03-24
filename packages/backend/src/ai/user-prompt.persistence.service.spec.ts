import { UserPromptPersistenceService } from './user-prompt.persistence.service';
import { getRepository } from 'typeorm';
import type { SlackUser } from '../shared/db/models/SlackUser';

jest.mock('typeorm', () => ({
  getRepository: jest.fn(),
  Entity: () => jest.fn(),
  Column: () => jest.fn(),
  PrimaryGeneratedColumn: () => jest.fn(),
  ManyToOne: () => jest.fn(),
  OneToMany: () => jest.fn(),
  OneToOne: () => jest.fn(),
  Unique: () => jest.fn(),
  JoinColumn: () => jest.fn(),
}));

jest.mock('../shared/logger/logger', () => ({
  logger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

jest.mock('../shared/logger/error-logging', () => ({
  logError: jest.fn(),
}));

const buildMockRepo = (overrides: Partial<ReturnType<typeof buildMockRepo>> = {}) => ({
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  ...overrides,
});

describe('UserPromptPersistenceService', () => {
  let service: UserPromptPersistenceService;
  let mockRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserPromptPersistenceService();
    mockRepo = buildMockRepo();
    (getRepository as jest.Mock).mockReturnValue(mockRepo);
  });

  describe('getCustomPrompt', () => {
    it('returns the custom prompt when user exists and has one set', async () => {
      const user = { id: 1, slackId: 'U1', teamId: 'T1', customPrompt: 'respond like a pirate' } as SlackUser;
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.getCustomPrompt('U1', 'T1');

      expect(result).toBe('respond like a pirate');
    });

    it('returns null when user exists but has no custom prompt', async () => {
      const user = { id: 1, slackId: 'U1', teamId: 'T1', customPrompt: null } as SlackUser;
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.getCustomPrompt('U1', 'T1');

      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getCustomPrompt('U1', 'T1');

      expect(result).toBeNull();
    });

    it('returns null when repository throws', async () => {
      mockRepo.findOne.mockRejectedValue(new Error('db error'));

      const result = await service.getCustomPrompt('U1', 'T1');

      expect(result).toBeNull();
    });
  });

  describe('setCustomPrompt', () => {
    it('saves the custom prompt and returns true when user exists', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.setCustomPrompt('U1', 'T1', 'my custom prompt');

      expect(result).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { slackId: 'U1', teamId: 'T1' },
        { customPrompt: 'my custom prompt' },
      );
    });

    it('returns false when user is not found', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.setCustomPrompt('U1', 'T1', 'my custom prompt');

      expect(result).toBe(false);
    });

    it('returns false when repository throws', async () => {
      mockRepo.update.mockRejectedValue(new Error('db error'));

      const result = await service.setCustomPrompt('U1', 'T1', 'my custom prompt');

      expect(result).toBe(false);
    });
  });

  describe('clearCustomPrompt', () => {
    it('clears the custom prompt and returns true when user exists', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.clearCustomPrompt('U1', 'T1');

      expect(result).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith({ slackId: 'U1', teamId: 'T1' }, { customPrompt: null });
    });

    it('returns false when user is not found', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.clearCustomPrompt('U1', 'T1');

      expect(result).toBe(false);
    });

    it('returns false when repository throws', async () => {
      mockRepo.update.mockRejectedValue(new Error('db error'));

      const result = await service.clearCustomPrompt('U1', 'T1');

      expect(result).toBe(false);
    });
  });
});
