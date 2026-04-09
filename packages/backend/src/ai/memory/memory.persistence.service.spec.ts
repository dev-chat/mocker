import { vi } from 'vitest';
import { MemoryPersistenceService } from './memory.persistence.service';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { getRepository } from 'typeorm';

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

describe('MemoryPersistenceService', () => {
  let service: MemoryPersistenceService;
  let mockSlackUserRepo: Record<string, Mock>;
  let mockMemoryRepo: Record<string, Mock>;

  const mockUser: Partial<SlackUser> = {
    id: 1,
    slackId: 'U123',
    teamId: 'T456',
    name: 'testuser',
    isBot: false,
    botId: '',
  };

  const mockMemory: Partial<Memory> = {
    id: 1,
    userId: mockUser as SlackUser,
    teamId: 'T456',
    content: 'loves TypeScript',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemoryPersistenceService();

    mockSlackUserRepo = {
      findOne: vi.fn(),
    };

    mockMemoryRepo = {
      query: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    (getRepository as Mock).mockImplementation((entity) => {
      if (entity === SlackUser) return mockSlackUserRepo;
      if (entity === Memory) return mockMemoryRepo;
      return {};
    });
  });

  describe('saveMemories', () => {
    it('should save a single memory when given one item', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockResolvedValue([mockMemory]);

      const result = await service.saveMemories('U123', 'T456', ['loves TypeScript']);

      expect(mockMemoryRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ content: 'loves TypeScript' })]),
      );
      expect(result).toHaveLength(1);
    });

    it('should save multiple memories for a valid user', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockResolvedValue([mockMemory, { ...mockMemory, id: 2, content: 'hates CSS' }]);

      const result = await service.saveMemories('U123', 'T456', ['loves TypeScript', 'hates CSS']);

      expect(mockMemoryRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'loves TypeScript' }),
          expect.objectContaining({ content: 'hates CSS' }),
        ]),
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array if user not found', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(null);

      const result = await service.saveMemories('UNKNOWN', 'T456', ['fact1']);

      expect(result).toEqual([]);
    });

    it('should return empty array on save error', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockRejectedValue(new Error('DB error'));

      const result = await service.saveMemories('U123', 'T456', ['fact1']);

      expect(result).toEqual([]);
    });
  });

  describe('getAllMemoriesForUser', () => {
    it('should return all memories without LIMIT', async () => {
      mockMemoryRepo.query.mockResolvedValue([mockMemory]);

      const result = await service.getAllMemoriesForUser('U123', 'T456');

      expect(mockMemoryRepo.query).toHaveBeenCalledWith(expect.not.stringContaining('LIMIT'), ['U123', 'T456']);
      expect(result).toEqual([mockMemory]);
    });

    it('should return empty array on error', async () => {
      mockMemoryRepo.query.mockRejectedValue(new Error('DB error'));

      const result = await service.getAllMemoriesForUser('U123', 'T456');

      expect(result).toEqual([]);
    });
  });

  describe('getAllMemoriesForUsers', () => {
    it('should return all memories grouped by slackId without LIMIT', async () => {
      const memoryU123 = [mockMemory, { ...mockMemory, id: 2, content: 'hates CSS' }];
      const memoryU789 = [{ ...mockMemory, id: 3, content: 'Go expert' }];

      mockMemoryRepo.query.mockResolvedValueOnce(memoryU123).mockResolvedValueOnce(memoryU789);

      const result = await service.getAllMemoriesForUsers(['U123', 'U789'], 'T456');

      expect(result.get('U123')?.length).toBe(2);
      expect(result.get('U789')?.length).toBe(1);
    });
  });

  describe('reinforceMemory', () => {
    it('should update the timestamp and return true', async () => {
      mockMemoryRepo.query.mockResolvedValue(undefined);

      const result = await service.reinforceMemory(1);

      expect(mockMemoryRepo.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE memory SET updatedAt'), [1]);
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockMemoryRepo.query.mockRejectedValue(new Error('DB error'));

      const result = await service.reinforceMemory(1);

      expect(result).toBe(false);
    });
  });

  describe('deleteMemory', () => {
    it('should return true when memory is deleted', async () => {
      mockMemoryRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteMemory(1);

      expect(result).toBe(true);
    });

    it('should return false when memory not found', async () => {
      mockMemoryRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteMemory(999);

      expect(result).toBe(false);
    });

    it('should return false on delete error', async () => {
      mockMemoryRepo.delete.mockRejectedValue(new Error('DB error'));

      const result = await service.deleteMemory(1);

      expect(result).toBe(false);
    });
  });
});
