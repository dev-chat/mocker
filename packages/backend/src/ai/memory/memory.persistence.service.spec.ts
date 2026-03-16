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
    source: 'extracted',
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
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    (getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === SlackUser) return mockSlackUserRepo;
      if (entity === Memory) return mockMemoryRepo;
      return {};
    });
  });

  describe('getMemoriesForUser', () => {
    it('should return memories for a valid user', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.find.mockResolvedValue([mockMemory]);

      const result = await service.getMemoriesForUser('U123', 'T456');

      expect(mockSlackUserRepo.findOne).toHaveBeenCalledWith({ where: { slackId: 'U123', teamId: 'T456' } });
      expect(mockMemoryRepo.find).toHaveBeenCalledWith({
        where: { userId: mockUser, teamId: 'T456' },
        order: { updatedAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual([mockMemory]);
    });

    it('should return empty array if user not found', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(null);

      const result = await service.getMemoriesForUser('UNKNOWN', 'T456');

      expect(result).toEqual([]);
      expect(mockMemoryRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getMemoriesForUsers', () => {
    it('should return empty map for empty slackIds', async () => {
      const result = await service.getMemoriesForUsers([], 'T456');
      expect(result.size).toBe(0);
    });

    it('should return memories grouped by slackId', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { ...mockMemory, userId: { slackId: 'U123' } },
          { ...mockMemory, id: 2, content: 'hates CSS', userId: { slackId: 'U123' } },
          { ...mockMemory, id: 3, content: 'Go expert', userId: { slackId: 'U789' } },
        ]),
      };
      mockMemoryRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getMemoriesForUsers(['U123', 'U789'], 'T456');

      expect(result.get('U123')?.length).toBe(2);
      expect(result.get('U789')?.length).toBe(1);
    });
  });

  describe('saveMemory', () => {
    it('should save a memory for a valid user', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockResolvedValue(mockMemory);

      const result = await service.saveMemory('U123', 'T456', 'loves TypeScript');

      expect(mockMemoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser,
          teamId: 'T456',
          content: 'loves TypeScript',
          source: 'extracted',
        }),
      );
      expect(result).toEqual(mockMemory);
    });

    it('should return null if user not found', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(null);

      const result = await service.saveMemory('UNKNOWN', 'T456', 'some fact');

      expect(result).toBeNull();
      expect(mockMemoryRepo.save).not.toHaveBeenCalled();
    });

    it('should return null on save error', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.save.mockRejectedValue(new Error('DB error'));

      const result = await service.saveMemory('U123', 'T456', 'some fact');

      expect(result).toBeNull();
    });
  });

  describe('saveMemories', () => {
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

  describe('getMemoryCount', () => {
    it('should return count for a valid user', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(mockUser);
      mockMemoryRepo.count.mockResolvedValue(5);

      const result = await service.getMemoryCount('U123', 'T456');

      expect(result).toBe(5);
    });

    it('should return 0 if user not found', async () => {
      mockSlackUserRepo.findOne.mockResolvedValue(null);

      const result = await service.getMemoryCount('UNKNOWN', 'T456');

      expect(result).toBe(0);
    });
  });
});
