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

export interface MuzzleReport {
  muzzled: MuzzleReportItem;
  muzzlers: MuzzleReportItem;
  accuracy: Accuracy[];
  kdr: any[];
  rawNemesis: any[];
  successNemesis: any[];
  backfires: any[];
}

export interface ReportCount {
  slackId: string;
  count: number;
}

export interface Accuracy {
  requestorId: number;
  accuracy: number;
  kills: number;
  deaths: number;
}

interface MuzzleReportItem {
  byInstances: ReportCount[];
  byMessages: ReportCount[];
  byWords: ReportCount[];
  byChars: ReportCount[];
  byTime: ReportCount[];
}
