import { MemoryPersistenceService } from './memory.persistence.service';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { getRepository } from 'typeorm';

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

jest.mock('../../shared/logger/logger', () => ({
  logger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

describe('MemoryPersistenceService', () => {
  let service: MemoryPersistenceService;
  let mockSlackUserRepo: Record<string, jest.Mock>;
  let mockMemoryRepo: Record<string, jest.Mock>;

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
    jest.clearAllMocks();
    service = new MemoryPersistenceService();

    mockSlackUserRepo = {
      findOne: jest.fn(),
    };

    mockMemoryRepo = {
      query: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    (getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === SlackUser) return mockSlackUserRepo;
      if (entity === Memory) return mockMemoryRepo;
      return {};
    });
  });

  describe('getMemoriesForUser', () => {
    it('should return memories using a single JOIN query', async () => {
      mockMemoryRepo.query.mockResolvedValue([mockMemory]);

      const result = await service.getMemoriesForUser('U123', 'T456');

      expect(mockMemoryRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN slack_user'),
        ['U123', 'T456', 10],
      );
      expect(result).toEqual([mockMemory]);
    });

    it('should return empty array on query error', async () => {
      mockMemoryRepo.query.mockRejectedValue(new Error('DB error'));

      const result = await service.getMemoriesForUser('U123', 'T456');

      expect(result).toEqual([]);
    });
  });

  describe('getMemoriesForUsers', () => {
    it('should return empty map for empty slackIds', async () => {
      const result = await service.getMemoriesForUsers([], 'T456');
      expect(result.size).toBe(0);
    });

    it('should return memories grouped by slackId', async () => {
      mockMemoryRepo.query.mockResolvedValue([
        { ...mockMemory, slackId: 'U123' },
        { ...mockMemory, id: 2, content: 'hates CSS', slackId: 'U123' },
        { ...mockMemory, id: 3, content: 'Go expert', slackId: 'U789' },
      ]);

      const result = await service.getMemoriesForUsers(['U123', 'U789'], 'T456');

      expect(mockMemoryRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ROW_NUMBER()'),
        ['T456', 'U123', 'U789', 10],
      );
      expect(result.get('U123')?.length).toBe(2);
      expect(result.get('U789')?.length).toBe(1);
    });

    it('should return empty map on query error', async () => {
      mockMemoryRepo.query.mockRejectedValue(new Error('DB error'));

      const result = await service.getMemoriesForUsers(['U123'], 'T456');

      expect(result.size).toBe(0);
    });
  });

  describe('saveMemories', () => {
    it('should save a single memory when given one item', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockResolvedValue([mockMemory]);

      const result = await service.saveMemories('U123', 'T456', ['loves TypeScript']);

      expect(mockMemoryRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'loves TypeScript' }),
        ]),
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
