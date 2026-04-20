import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraitService } from './trait.service';

describe('AITraitService', () => {
  let traitPersistenceService: {
    getAllTraitsForUsers: ReturnType<typeof vi.fn>;
  };
  let service: TraitService;

  beforeEach(() => {
    traitPersistenceService = {
      getAllTraitsForUsers: vi.fn().mockResolvedValue(new Map()),
    };

    service = new TraitService(traitPersistenceService as never);
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
});
