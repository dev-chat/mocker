import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraitService } from './trait.service';

describe('AITraitService', () => {
  let traitPersistenceService: {
    getAllTraitsForUsers: ReturnType<typeof vi.fn>;
    replaceTraitsForUser: ReturnType<typeof vi.fn>;
  };
  let memoryPersistenceService: {
    getAllMemoriesForUser: ReturnType<typeof vi.fn>;
  };
  let logger: {
    warn: ReturnType<typeof vi.fn>;
  };
  let service: TraitService;

  beforeEach(() => {
    traitPersistenceService = {
      getAllTraitsForUsers: vi.fn().mockResolvedValue(new Map()),
      replaceTraitsForUser: vi.fn().mockResolvedValue([]),
    };
    memoryPersistenceService = {
      getAllMemoriesForUser: vi.fn().mockResolvedValue([]),
    };
    logger = {
      warn: vi.fn(),
    };

    service = new TraitService(traitPersistenceService as never, memoryPersistenceService as never, logger);
  });

  it('extracts participant ids with include and exclude rules', () => {
    const ids = service.extractParticipantSlackIds(
      [
        { slackId: 'U1', name: 'A', message: 'm1' } as never,
        { slackId: 'U2', name: 'B', message: 'm2' } as never,
        { slackId: 'U2', name: 'B', message: 'm3' } as never,
      ],
      { includeSlackId: 'U3', excludeSlackIds: ['U1'] },
    );

    expect(ids).toEqual(['U2', 'U3']);
  });

  it('formats trait context grouped by participant name', () => {
    const text = service.formatTraitContext(
      [
        { slackId: 'U1', content: 'prefers typescript' } as never,
        { slackId: 'U2', content: 'dislikes donald trump' } as never,
      ],
      [
        { slackId: 'U1', name: 'Alice', message: 'hi' } as never,
        { slackId: 'U2', name: 'Bob', message: 'hello' } as never,
      ],
    );

    expect(text).toContain('traits_context');
    expect(text).toContain('Alice');
    expect(text).toContain('prefers typescript');
    expect(text).toContain('Bob');
  });

  it('returns base instructions when there is no trait context', () => {
    expect(service.appendTraitContext('base', '')).toBe('base');
  });

  it('inserts trait context before verification section', () => {
    const base = 'instructions\n<verification>\nchecklist\n</verification>';
    const context = '<traits_context>\ntest trait\n</traits_context>';

    const result = service.appendTraitContext(base, context);

    expect(result).toContain('test trait');
    expect(result.indexOf('traits_context')).toBeLessThan(result.indexOf('<verification>'));
  });

  it('fetches trait context from persistence layer', async () => {
    traitPersistenceService.getAllTraitsForUsers.mockResolvedValue(
      new Map([['U1', [{ slackId: 'U1', content: 'prefers typescript' }]]]),
    );

    const context = await service.fetchTraitContext(['U1'], 'T1', [{ slackId: 'U1', name: 'Alice' } as never]);

    expect(context).toContain('prefers typescript');
  });

  it('parses, de-duplicates, and caps extracted traits', () => {
    const traits = service.parseTraitExtractionResult(
      JSON.stringify([...Array.from({ length: 12 }, (_, i) => `trait-${i}`), 'trait-1']),
    );

    expect(traits).toHaveLength(10);
    expect(new Set(traits).size).toBe(10);
  });

  it('returns empty traits for malformed extraction payload', () => {
    expect(service.parseTraitExtractionResult('{bad')).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('regenerates traits for users from memories', async () => {
    memoryPersistenceService.getAllMemoriesForUser
      .mockResolvedValueOnce([{ content: 'JR-15 loves TypeScript' }])
      .mockResolvedValueOnce([]);

    const synthesizeTraits = vi.fn().mockResolvedValue(JSON.stringify(['JR-15 prefers TypeScript']));

    await service.regenerateTraitsForUsers('T1', ['U1', 'U2'], synthesizeTraits);

    expect(traitPersistenceService.replaceTraitsForUser).toHaveBeenCalledWith('U1', 'T1', ['JR-15 prefers TypeScript']);
    expect(traitPersistenceService.replaceTraitsForUser).toHaveBeenCalledWith('U2', 'T1', []);
  });
});
