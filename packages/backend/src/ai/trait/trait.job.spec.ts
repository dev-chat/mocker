import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraitJob } from './trait.job';

describe('TraitJob', () => {
  let job: TraitJob;
  let traitPersistenceService: {
    replaceTraitsForUser: ReturnType<typeof vi.fn>;
  };
  let memoryPersistenceService: {
    getAllMemoriesForUser: ReturnType<typeof vi.fn>;
  };
  let aiService: {
    openAi: {
      responses: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };
  let jobLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    job = new TraitJob({} as never);
    traitPersistenceService = {
      replaceTraitsForUser: vi.fn().mockResolvedValue([]),
    };
    memoryPersistenceService = {
      getAllMemoriesForUser: vi.fn().mockResolvedValue([]),
    };
    aiService = {
      openAi: {
        responses: {
          create: vi.fn(),
        },
      },
    };
    jobLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    (job as never as { traitPersistenceService: unknown }).traitPersistenceService = traitPersistenceService;
    (job as never as { memoryPersistenceService: unknown }).memoryPersistenceService = memoryPersistenceService;
    (job as never as { aiService: unknown }).aiService = aiService;
    (job as never as { jobLogger: unknown }).jobLogger = jobLogger;
  });

  it('parses, de-duplicates, and caps extracted traits', () => {
    const traits = (
      job as never as { parseTraitExtractionResult: (raw: string) => string[] }
    ).parseTraitExtractionResult(
      JSON.stringify([...Array.from({ length: 12 }, (_, index) => `trait-${index}`), 'trait-1']),
    );

    expect(traits).toHaveLength(10);
    expect(new Set(traits).size).toBe(10);
  });

  it('returns empty traits for malformed extraction payload', () => {
    const traits = (
      job as never as { parseTraitExtractionResult: (raw: string) => string[] }
    ).parseTraitExtractionResult('{bad');

    expect(traits).toEqual([]);
    expect(jobLogger.warn).toHaveBeenCalled();
  });

  it('regenerates traits for users from memories', async () => {
    memoryPersistenceService.getAllMemoriesForUser
      .mockResolvedValueOnce([{ content: 'JR-15 loves TypeScript' }])
      .mockResolvedValueOnce([]);

    const synthesizeTraits = vi.fn().mockResolvedValue(JSON.stringify(['JR-15 prefers TypeScript']));

    await (
      job as never as {
        regenerateTraitsForUsers: (
          teamId: string,
          slackIds: string[],
          synthesizeTraits: (input: string) => Promise<string | undefined>,
        ) => Promise<void>;
      }
    ).regenerateTraitsForUsers('T1', ['U1', 'U2'], synthesizeTraits);

    expect(traitPersistenceService.replaceTraitsForUser).toHaveBeenCalledWith('U1', 'T1', ['JR-15 prefers TypeScript']);
    expect(traitPersistenceService.replaceTraitsForUser).toHaveBeenCalledWith('U2', 'T1', []);
  });
});
