import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryService } from './memory.service';

describe('AIMemoryService', () => {
  let memoryPersistenceService: {
    getAllMemoriesForUsers: ReturnType<typeof vi.fn>;
    saveMemories: ReturnType<typeof vi.fn>;
    reinforceMemory: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
  };
  let extractionLockStore: {
    getExtractionLock: ReturnType<typeof vi.fn>;
    setExtractionLock: ReturnType<typeof vi.fn>;
  };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let service: MemoryService;

  beforeEach(() => {
    memoryPersistenceService = {
      getAllMemoriesForUsers: vi.fn().mockResolvedValue(new Map()),
      saveMemories: vi.fn().mockResolvedValue([]),
      reinforceMemory: vi.fn().mockResolvedValue(true),
      deleteMemory: vi.fn().mockResolvedValue(true),
    };
    extractionLockStore = {
      getExtractionLock: vi.fn().mockResolvedValue(null),
      setExtractionLock: vi.fn().mockResolvedValue('OK'),
    };
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    service = new MemoryService(memoryPersistenceService as never, extractionLockStore as never, logger);
  });

  it('returns early when extraction lock exists', async () => {
    extractionLockStore.getExtractionLock.mockResolvedValue('1');

    await service.extractMemories('T1', 'C1', 'history', ['U1'], vi.fn(), vi.fn());

    expect(logger.info).toHaveBeenCalled();
  });

  it('does nothing when extractor returns NONE', async () => {
    const extractFromConversation = vi.fn().mockResolvedValue('NONE');

    await service.extractMemories('T1', 'C1', 'history', ['U1'], extractFromConversation, vi.fn());

    expect(memoryPersistenceService.saveMemories).not.toHaveBeenCalled();
  });

  it('processes NEW, REINFORCE, and EVOLVE extraction modes', async () => {
    const extractFromConversation = vi.fn().mockResolvedValue(
      JSON.stringify([
        { slackId: 'U123ABC', content: 'new memory', mode: 'NEW' },
        { slackId: 'U123ABC', content: 'reinforce memory', mode: 'REINFORCE', existingMemoryId: 10 },
        { slackId: 'U123ABC', content: 'evolved memory', mode: 'EVOLVE', existingMemoryId: 11 },
      ]),
    );
    const regenerateTraitsForUsers = vi.fn().mockResolvedValue(undefined);

    await service.extractMemories(
      'T1',
      'C1',
      'history',
      ['U123ABC'],
      extractFromConversation,
      regenerateTraitsForUsers,
    );

    expect(memoryPersistenceService.saveMemories).toHaveBeenCalled();
    expect(memoryPersistenceService.reinforceMemory).toHaveBeenCalledWith(10);
    expect(memoryPersistenceService.deleteMemory).toHaveBeenCalledWith(11);
    expect(regenerateTraitsForUsers).toHaveBeenCalledWith('T1', ['U123ABC']);
  });

  it('skips malformed extraction items and logs warnings', async () => {
    const extractFromConversation = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify([
          { mode: 'NEW' },
          { slackId: 'invalid', content: 'x', mode: 'NEW' },
          { slackId: 'U123ABC', content: 'x', mode: 'UNKNOWN' },
        ]),
      );

    await service.extractMemories('T1', 'C1', 'history', ['U123ABC'], extractFromConversation, vi.fn());

    expect(logger.warn).toHaveBeenCalled();
  });
});
