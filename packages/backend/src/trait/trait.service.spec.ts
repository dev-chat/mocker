import { vi } from 'vitest';
import { TraitService } from './trait.service';

const { getAllTraitsForUser, getAllTraitsForUsers, sendEphemeral } = vi.hoisted(() => ({
  getAllTraitsForUser: vi.fn().mockResolvedValue([]),
  getAllTraitsForUsers: vi.fn().mockResolvedValue(new Map()),
  sendEphemeral: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('./trait.persistence.service', async () => ({
  TraitPersistenceService: classMock(() => ({
    getAllTraitsForUser,
    getAllTraitsForUsers,
  })),
}));

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    sendEphemeral,
  })),
}));

describe('TraitService', () => {
  let service: TraitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TraitService();
  });

  it('sends formatted traits when they exist', async () => {
    getAllTraitsForUser.mockResolvedValue([
      {
        content: 'JR-15 prefers TypeScript as his programming language',
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    await service.sendTraitsForUser('U1', 'T1', 'C1');

    expect(getAllTraitsForUser).toHaveBeenCalledWith('U1', 'T1');
    expect(sendEphemeral).toHaveBeenCalledWith(
      'C1',
      expect.stringContaining("Moonbeam's core traits about you:"),
      'U1',
    );
  });

  it('sends no-traits message when user has no traits', async () => {
    getAllTraitsForUser.mockResolvedValue([]);

    await service.sendTraitsForUser('U1', 'T1', 'C1');

    expect(sendEphemeral).toHaveBeenCalledWith('C1', "Moonbeam doesn't have any core traits about you yet.", 'U1');
  });

  it('sends fallback error message when trait retrieval fails', async () => {
    getAllTraitsForUser.mockRejectedValueOnce(new Error('db fail'));

    await service.sendTraitsForUser('U1', 'T1', 'C1');

    expect(sendEphemeral).toHaveBeenCalledWith('C1', 'Sorry, something went wrong fetching your traits.', 'U1');
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
    getAllTraitsForUsers.mockResolvedValue(new Map([['U1', [{ slackId: 'U1', content: 'prefers typescript' }]]]));

    const context = await service.fetchTraitContext(['U1'], 'T1', [{ slackId: 'U1', name: 'Alice' } as never]);

    expect(context).toContain('prefers typescript');
  });
});
