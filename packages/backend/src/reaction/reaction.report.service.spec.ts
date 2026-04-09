import { vi } from 'vitest';
import { ReactionReportService } from './reaction.report.service';

type ReactionReportDependencies = ReactionReportService & {
  reactionPersistenceService: {
    getTotalRep: Mock;
    getRepByUser: Mock;
  };
  slackService: {
    getUserNameById: Mock;
  };
  getSentiment: (rep: number, totalRep: number) => string;
};

describe('ReactionReportService', () => {
  let service: ReactionReportService;
  const getTotalRep = vi.fn();
  const getRepByUser = vi.fn();
  const getUserNameById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReactionReportService();
    const dependencyTarget = service as unknown as ReactionReportDependencies;
    dependencyTarget.reactionPersistenceService = { getTotalRep, getRepByUser };
    dependencyTarget.slackService = { getUserNameById };
  });

  it('returns formatted rep report with available rep message', async () => {
    getTotalRep.mockResolvedValue({ totalRepAvailable: 10, totalRepEarned: 20 });
    getRepByUser.mockResolvedValue([
      { reactingUser: 'U1', rep: 10 },
      { reactingUser: 'ADMIN', rep: 10 },
    ]);
    getUserNameById.mockResolvedValue('alice');

    const out = await service.getRep('U2', 'T1');

    expect(out).toContain('You currently have _10_ rep available to spend');
    expect(out).toContain('You have earned a total of _20_ in your lifetime');
    expect(getUserNameById).toHaveBeenCalledWith('U1', 'T1');
    expect(out).toContain('Stimulus - Dec 2022');
  });

  it('returns no-rep message when totalRepAvailable is 0', async () => {
    getTotalRep.mockResolvedValue({ totalRepAvailable: 0, totalRepEarned: 0 });
    getRepByUser.mockResolvedValue(undefined);

    const out = await service.getRep('U2', 'T1');

    expect(out).toContain('You do not currently have any rep.');
    expect(out).toContain('You do not have any existing relationships.');
  });

  it('throws friendly error when total rep lookup fails', async () => {
    getTotalRep.mockRejectedValue(new Error('db fail'));

    await expect(service.getRep('U2', 'T1')).rejects.toThrow('Unable to retrieve your rep due to an error!');
  });

  it('propagates rep-by-user formatting errors', async () => {
    getTotalRep.mockResolvedValue({ totalRepAvailable: 1, totalRepEarned: 1 });
    getRepByUser.mockRejectedValue(new Error('bad list'));

    await expect(service.getRep('U2', 'T1')).rejects.toThrow('bad list');
  });

  it('maps sentiment buckets correctly', () => {
    const getSentiment = (service as unknown as ReactionReportDependencies).getSentiment.bind(service);

    expect(getSentiment(50, 100)).toBe('Worshipped');
    expect(getSentiment(45, 100)).toBe('Enamored');
    expect(getSentiment(35, 100)).toBe('Adored');
    expect(getSentiment(30, 100)).toBe('Loved');
    expect(getSentiment(25, 100)).toBe('Endeared');
    expect(getSentiment(20, 100)).toBe('Admired');
    expect(getSentiment(15, 100)).toBe('Esteemed');
    expect(getSentiment(10, 100)).toBe('Well Liked');
    expect(getSentiment(5, 100)).toBe('Liked');
    expect(getSentiment(1, 100)).toBe('Respected');
    expect(getSentiment(0, 100)).toBe('Neutral');
  });
});
