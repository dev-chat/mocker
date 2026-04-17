import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { TraitPersistenceService } from './trait.persistence.service';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { Trait } from '../../shared/db/models/Trait';

vi.mock('typeorm', async () => ({
  getRepository: vi.fn(),
  Entity: () => vi.fn(),
  Column: () => vi.fn(),
  PrimaryGeneratedColumn: () => vi.fn(),
  ManyToOne: () => vi.fn(),
  OneToMany: () => vi.fn(),
  OneToOne: () => vi.fn(),
  Unique: () => vi.fn(),
  JoinColumn: () => vi.fn(),
}));

vi.mock('../../shared/logger/logger', async () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('TraitPersistenceService', () => {
  let service: TraitPersistenceService;
  let mockSlackUserRepo: Record<string, Mock>;
  let mockTraitRepo: Record<string, Mock>;

  const mockUser: Partial<SlackUser> = {
    id: 1,
    slackId: 'U123',
    teamId: 'T456',
    name: 'testuser',
    isBot: false,
    botId: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TraitPersistenceService();

    mockSlackUserRepo = {
      findOne: vi.fn(),
    };

    mockTraitRepo = {
      query: vi.fn(),
      save: vi.fn(),
    };

    (getRepository as Mock).mockImplementation((entity) => {
      if (entity === SlackUser) return mockSlackUserRepo;
      if (entity === Trait) return mockTraitRepo;
      return {};
    });
  });

  describe('replaceTraitsForUser', () => {
    it('replaces traits and caps output to 10', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockTraitRepo.query.mockResolvedValue(undefined);
      mockTraitRepo.save.mockResolvedValue([]);

      await service.replaceTraitsForUser(
        'U123',
        'T456',
        Array.from({ length: 12 }, (_, i) => `trait-${i + 1}`),
      );

      expect(mockTraitRepo.query).toHaveBeenCalledWith('DELETE FROM trait WHERE userIdId = ? AND teamId = ?', [
        1,
        'T456',
      ]);
      expect(mockTraitRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ content: 'trait-1' })]),
      );
      expect((mockTraitRepo.save as Mock).mock.calls[0][0]).toHaveLength(10);
    });

    it('returns empty array when user is missing', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(null);

      const result = await service.replaceTraitsForUser('UNKNOWN', 'T456', ['a']);

      expect(result).toEqual([]);
      expect(mockTraitRepo.query).not.toHaveBeenCalled();
    });

    it('deletes traits and skips save for empty normalized traits', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockTraitRepo.query.mockResolvedValue(undefined);

      const result = await service.replaceTraitsForUser('U123', 'T456', ['  ', '']);

      expect(result).toEqual([]);
      expect(mockTraitRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllTraitsForUser', () => {
    it('returns traits for user', async () => {
      mockTraitRepo.query.mockResolvedValue([{ id: 1, content: 'likes TypeScript', slackId: 'U123' }]);

      const result = await service.getAllTraitsForUser('U123', 'T456');

      expect(result).toEqual([{ id: 1, content: 'likes TypeScript', slackId: 'U123' }]);
    });

    it('returns empty array on query failure', async () => {
      mockTraitRepo.query.mockRejectedValue(new Error('db fail'));

      const result = await service.getAllTraitsForUser('U123', 'T456');

      expect(result).toEqual([]);
    });
  });

  describe('getAllTraitsForUsers', () => {
    it('returns grouped traits by slack id', async () => {
      mockTraitRepo.query.mockResolvedValueOnce([
        { id: 1, content: 'likes TypeScript', slackId: 'U123' },
        { id: 2, content: 'hates Java', slackId: 'U789' },
      ]);

      const result = await service.getAllTraitsForUsers(['U123', 'U789'], 'T456');

      expect(result.get('U123')?.length).toBe(1);
      expect(result.get('U789')?.length).toBe(1);
    });
  });
});
