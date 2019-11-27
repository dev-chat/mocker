export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number; // Refers to either a muzzleID or backfireID from the database. Dependent on isBackfire.
  isBackfire: boolean;
  removalFn: NodeJS.Timeout;
  attemptedToMuzzle?: string;
}

export interface IRequestor {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}

export enum ReportType {
  Trailing30 = "trailing30",
  Week = "week",
  Month = "month",
  Year = "year",
  AllTime = "all"
}

export interface IReportRange {
  start?: string;
  end?: string;
  reportType: ReportType;
}
