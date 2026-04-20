import { vi } from 'vitest';
import { TraitService } from './trait.service';

const { getAllTraitsForUser, sendEphemeral } = vi.hoisted(() => ({
  getAllTraitsForUser: vi.fn().mockResolvedValue([]),
  sendEphemeral: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../ai/trait/trait.persistence.service', async () => ({
  TraitPersistenceService: classMock(() => ({
    getAllTraitsForUser,
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
});
