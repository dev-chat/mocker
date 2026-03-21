import { getManager, getRepository } from 'typeorm';
import { Muzzle } from '../shared/db/models/Muzzle';
import type { MuzzleReport, ReportRange} from '../shared/models/report/report.model';
import { ReportType } from '../shared/models/report/report.model';
import { MuzzleReportService } from './muzzle.report.service';

type MuzzleReportPrivateMethods = MuzzleReportService & {
  slackService: {
    getUserNameById: jest.Mock;
  };
  formatReport: (report: MuzzleReport, teamId: string) => Promise<Record<string, unknown>>;
  getMostMuzzledByInstances: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMostMuzzledByMessages: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMostMuzzledByWords: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMostMuzzledByChars: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMostMuzzledByTime: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMuzzlerByInstances: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMuzzlerByMessages: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMuzzlerByWords: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMuzzlerByChars: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getMuzzlerByTime: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getAccuracy: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getKdr: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getNemesisByRaw: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getNemesisBySuccessful: (range: ReportRange, teamId: string) => Promise<unknown[]>;
  getBackfireData: (range: ReportRange, teamId: string) => Promise<unknown[]>;
};

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
    getManager: jest.fn(),
  };
});

describe('MuzzleReportService', () => {
  let service: MuzzleReportService;
  const repoQuery = jest.fn();
  const managerQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MuzzleReportService();
    const dependencyTarget = service as unknown as MuzzleReportPrivateMethods;
    dependencyTarget.slackService = {
      getUserNameById: jest.fn().mockResolvedValue('user-name'),
    };
    (getRepository as jest.Mock).mockImplementation((model: unknown) => {
      if (model === Muzzle) {
        return { query: repoQuery };
      }
      return {};
    });
    (getManager as jest.Mock).mockReturnValue({ query: managerQuery });
  });

  it('builds report title for each type', () => {
    expect(service.getReportTitle(ReportType.AllTime)).toContain('All Time');
    expect(service.getReportTitle(ReportType.Week)).toContain('Weekly');
    expect(service.getReportTitle(ReportType.Month)).toContain('Monthly');
    expect(service.getReportTitle(ReportType.Trailing7)).toContain('Trailing 7 Days');
    expect(service.getReportTitle(ReportType.Trailing30)).toContain('Trailing 30 Days');
    expect(service.getReportTitle(ReportType.Year)).toContain('Annual');
  });

  it('getMuzzleReport composes retrieved report into formatted output', async () => {
    const retrieveSpy = jest.spyOn(service, 'retrieveMuzzleReport').mockResolvedValue({
      muzzled: { byInstances: [], byMessages: [], byWords: [], byChars: [], byTime: [] },
      muzzlers: { byInstances: [], byMessages: [], byWords: [], byChars: [], byTime: [] },
      accuracy: [],
      kdr: [],
      rawNemesis: [],
      successNemesis: [],
      backfires: [],
    });

    const out = await service.getMuzzleReport(ReportType.AllTime, 'T1');

    expect(retrieveSpy).toHaveBeenCalled();
    expect(out).toContain('All Time Muzzle Report');
    expect(out).toContain('Top Muzzled');
  });

  it('retrieveMuzzleReport aggregates all helper query outputs', async () => {
    const privateService = service as unknown as MuzzleReportPrivateMethods;
    jest.spyOn(privateService, 'getMostMuzzledByInstances').mockResolvedValue([{ slackId: 'U1', count: 1 }]);
    jest.spyOn(privateService, 'getMostMuzzledByMessages').mockResolvedValue([{ slackId: 'U1', count: 1 }]);
    jest.spyOn(privateService, 'getMostMuzzledByWords').mockResolvedValue([{ slackId: 'U1', count: 1 }]);
    jest.spyOn(privateService, 'getMostMuzzledByChars').mockResolvedValue([{ slackId: 'U1', count: 1 }]);
    jest.spyOn(privateService, 'getMostMuzzledByTime').mockResolvedValue([{ slackId: 'U1', count: 1 }]);
    jest.spyOn(privateService, 'getMuzzlerByInstances').mockResolvedValue([{ slackId: 'U2', count: 2 }]);
    jest.spyOn(privateService, 'getMuzzlerByMessages').mockResolvedValue([{ slackId: 'U2', count: 2 }]);
    jest.spyOn(privateService, 'getMuzzlerByWords').mockResolvedValue([{ slackId: 'U2', count: 2 }]);
    jest.spyOn(privateService, 'getMuzzlerByChars').mockResolvedValue([{ slackId: 'U2', count: 2 }]);
    jest.spyOn(privateService, 'getMuzzlerByTime').mockResolvedValue([{ slackId: 'U2', count: 2 }]);
    jest.spyOn(privateService, 'getAccuracy').mockResolvedValue([{ requestorId: 'U2', accuracy: 1 }]);
    jest.spyOn(privateService, 'getKdr').mockResolvedValue([{ requestorId: 'U2', kdr: 1 }]);
    jest.spyOn(privateService, 'getNemesisByRaw').mockResolvedValue([{ requestorId: 'U2', muzzledId: 'U1' }]);
    jest.spyOn(privateService, 'getNemesisBySuccessful').mockResolvedValue([{ requestorId: 'U2', muzzledId: 'U1' }]);
    jest.spyOn(privateService, 'getBackfireData').mockResolvedValue([{ muzzledId: 'U2', backfires: 1 }]);

    const out = await service.retrieveMuzzleReport({ reportType: ReportType.AllTime }, 'T1');

    expect(out.muzzled.byInstances).toHaveLength(1);
    expect(out.muzzlers.byInstances).toHaveLength(1);
    expect(out.accuracy).toHaveLength(1);
  });

  it('formats report rows with slack usernames', async () => {
    const privateService = service as unknown as MuzzleReportPrivateMethods;
    const formatted = (await privateService.formatReport(
      {
        muzzled: { byInstances: [{ slackId: 'U1', count: 1 }] },
        muzzlers: { byInstances: [{ slackId: 'U2', count: 2 }] },
        accuracy: [{ requestorId: 'U2', accuracy: 0.5, kills: 1, deaths: 2 }],
        kdr: [{ requestorId: 'U2', kdr: 1.5, kills: 3, deaths: 2 }],
        rawNemesis: [{ requestorId: 'U2', muzzledId: 'U1', killCount: 4 }],
        successNemesis: [{ requestorId: 'U2', muzzledId: 'U1', killCount: 2 }],
        backfires: [{ muzzledId: 'U2', backfires: 1, muzzles: 2, backfirePct: 33 }],
      },
      'T1',
    )) as {
      muzzled: { byInstances: Array<{ User: string; Muzzles: number }> };
      muzzlers: { byInstances: Array<{ User: string }> };
    };

    expect(formatted.muzzled.byInstances[0]).toEqual(expect.objectContaining({ User: 'user-name', Muzzles: 1 }));
    expect(formatted.muzzlers.byInstances[0]).toEqual(expect.objectContaining({ User: 'user-name' }));
  });

  it('query helpers call repo/manager with SQL for AllTime and ranged reports', async () => {
    const privateService = service as unknown as MuzzleReportPrivateMethods;
    repoQuery.mockResolvedValue([{ count: 1 }]);
    managerQuery.mockResolvedValue([{ count: 1 }]);

    await privateService.getMostMuzzledByInstances({ reportType: ReportType.AllTime }, 'T1');
    await privateService.getMostMuzzledByInstances(
      { reportType: ReportType.Week, start: '2026-01-01', end: '2026-01-08' },
      'T1',
    );
    await privateService.getBackfireData({ reportType: ReportType.AllTime }, 'T1');
    await privateService.getBackfireData({ reportType: ReportType.Week, start: '2026-01-01', end: '2026-01-08' }, 'T1');
    await privateService.getKdr({ reportType: ReportType.AllTime }, 'T1');
    await privateService.getKdr({ reportType: ReportType.Week, start: '2026-01-01', end: '2026-01-08' }, 'T1');

    expect(repoQuery).toHaveBeenCalled();
    expect(managerQuery).toHaveBeenCalled();
  });
});
