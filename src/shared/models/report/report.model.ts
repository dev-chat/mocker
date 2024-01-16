export enum ReportType {
  Trailing7 = 'trailing7',
  Trailing30 = 'trailing30',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  AllTime = 'all',
}

export interface ReportRange {
  start?: string;
  end?: string;
  reportType: ReportType;
}

export interface ReportCount {
  slackId: string;
  count: number;
}

export interface Accuracy {
  requestorId: string;
  accuracy: number;
  kills: number;
  deaths: number;
}

export interface KDR {
  requestorId: string;
  kdr: number;
  kills: number;
  deaths: number;
}

export interface RawNemesis {
  requestorId: string;
  muzzledId: string;
  killCount: number;
}

export interface SuccessNemesis {
  requestorId: string;
  muzzledId: string;
  killCount: number;
}

export interface Backfires {
  muzzledId: string;
  backfires: number;
  muzzles: number;
  backfirePct: number;
}

export interface MuzzleReport {
  muzzled: MuzzleReportItem;
  muzzlers: MuzzleReportItem;
  accuracy: Accuracy[];
  kdr: KDR[];
  rawNemesis: RawNemesis[];
  successNemesis: SuccessNemesis[];
  backfires: Backfires[];
}

interface MuzzleReportItem {
  byInstances: ReportCount[];
  byMessages: ReportCount[];
  byWords: ReportCount[];
  byChars: ReportCount[];
  byTime: ReportCount[];
}
