import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryJob } from './memory.job';

describe('MemoryJob', () => {
  let job: MemoryJob;
  let memoryPersistenceService: {
    getAllMemoriesForUsers: ReturnType<typeof vi.fn>;
    saveMemories: ReturnType<typeof vi.fn>;
    reinforceMemory: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
  };
  let redis: {
    getValue: ReturnType<typeof vi.fn>;
    setValueWithExpire: ReturnType<typeof vi.fn>;
  };
  let traitJob: {
    runForUsers: ReturnType<typeof vi.fn>;
  };
  let jobLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let aiService: {
    openAi: {
      responses: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    job = new MemoryJob({ formatHistory: vi.fn() } as never);
    memoryPersistenceService = {
      getAllMemoriesForUsers: vi.fn().mockResolvedValue(new Map()),
      saveMemories: vi.fn().mockResolvedValue([]),
      reinforceMemory: vi.fn().mockResolvedValue(true),
      deleteMemory: vi.fn().mockResolvedValue(true),
    };
    redis = {
      getValue: vi.fn().mockResolvedValue(null),
      setValueWithExpire: vi.fn().mockResolvedValue('OK'),
    };
    traitJob = {
      runForUsers: vi.fn().mockResolvedValue(undefined),
    };
    jobLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    aiService = {
      openAi: {
        responses: {
          create: vi.fn(),
        },
      },
    };

    (job as never as { memoryPersistenceService: unknown }).memoryPersistenceService = memoryPersistenceService;
    (job as never as { redis: unknown }).redis = redis;
    (job as never as { traitJob: unknown }).traitJob = traitJob;
    (job as never as { jobLogger: unknown }).jobLogger = jobLogger;
    (job as never as { aiService: unknown }).aiService = aiService;
  });

  it('returns early when extraction lock exists', async () => {
    redis.getValue.mockResolvedValue('1');

    await (
      job as never as {
        extractMemories: (
          teamId: string,
          channelId: string,
          conversationHistory: string,
          participantSlackIds: string[],
        ) => Promise<void>;
      }
    ).extractMemories('T1', 'C1', 'history', ['U1']);

    expect(jobLogger.info).toHaveBeenCalled();
  });

  it('does nothing when extractor returns NONE', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'NONE' }] }],
    });

    await (
      job as never as {
        extractMemories: (
          teamId: string,
          channelId: string,
          conversationHistory: string,
          participantSlackIds: string[],
        ) => Promise<void>;
      }
    ).extractMemories('T1', 'C1', 'history', ['U1']);

    expect(memoryPersistenceService.saveMemories).not.toHaveBeenCalled();
  });

  it('processes NEW, REINFORCE, and EVOLVE extraction modes', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify([
                { slackId: 'U123ABC', content: 'new memory', mode: 'NEW' },
                { slackId: 'U123ABC', content: 'reinforce memory', mode: 'REINFORCE', existingMemoryId: 10 },
                { slackId: 'U123ABC', content: 'evolved memory', mode: 'EVOLVE', existingMemoryId: 11 },
              ]),
            },
          ],
        },
      ],
    });

    await (
      job as never as {
        extractMemories: (
          teamId: string,
          channelId: string,
          conversationHistory: string,
          participantSlackIds: string[],
        ) => Promise<void>;
      }
    ).extractMemories('T1', 'C1', 'history', ['U123ABC']);

    expect(memoryPersistenceService.saveMemories).toHaveBeenCalled();
    expect(memoryPersistenceService.reinforceMemory).toHaveBeenCalledWith(10);
    expect(memoryPersistenceService.deleteMemory).toHaveBeenCalledWith(11);
    expect(traitJob.runForUsers).toHaveBeenCalledWith('T1', ['U123ABC']);
  });

  it('skips malformed extraction items and logs warnings', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify([
                { mode: 'NEW' },
                { slackId: 'invalid', content: 'x', mode: 'NEW' },
                { slackId: 'U123ABC', content: 'x', mode: 'UNKNOWN' },
              ]),
            },
          ],
        },
      ],
    });

    await (
      job as never as {
        extractMemories: (
          teamId: string,
          channelId: string,
          conversationHistory: string,
          participantSlackIds: string[],
        ) => Promise<void>;
      }
    ).extractMemories('T1', 'C1', 'history', ['U123ABC']);

    expect(jobLogger.warn).toHaveBeenCalled();
  });
});
