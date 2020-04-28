export interface Muzzled {
  suppressionCount: number;
  muzzledBy: string;
  id: number;
  isCounter: boolean;
  removalFn: NodeJS.Timeout;
}

export interface Requestor {
  muzzleCount: number;
  muzzleCountRemover?: NodeJS.Timeout;
}

export enum ReportType {
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
