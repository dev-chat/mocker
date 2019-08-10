export interface IMuzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  removalFn: NodeJS.Timeout;
}

export interface IRequestor {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}

export enum ReportType {
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
