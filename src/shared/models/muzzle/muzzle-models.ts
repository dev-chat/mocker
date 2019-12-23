export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  isCounter: boolean;
  removalFn: NodeJS.Timeout;
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
