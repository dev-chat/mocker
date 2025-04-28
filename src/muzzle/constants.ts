export const MAX_MUZZLE_TIME = 3600000;
export const MAX_TIME_BETWEEN_MUZZLES = 3600;
export const MAX_SUPPRESSIONS = 7;
export const MAX_MUZZLES = 2;
export const ABUSE_PENALTY_TIME = 300000;
export const REPLACEMENT_TEXT = ['..mMm..'];
export const MAX_WORD_LENGTH = 10;
export const USER_REGEX = /[<]@\w+/gm;
export enum MuzzleRedisTypeEnum {
  'Muzzled' = 'muzzled',
  'Requestor' = 'requestor',
}

export interface FormattedMuzzleReportByInstances {
  User?: string;
  'Muzzles Issued'?: number;
  Muzzles?: number;
}

export interface FormattedMuzzleReportAccuracy {
  User?: string;
  accuracy?: string;
  kills?: string;
  deaths?: string;
}

export interface FormattedMuzzleReportKDR {
  User?: string;
  KDR?: number;
  kills?: string;
  deaths?: string;
}

export interface FormattedMuzzleReportRawNemesis {
  Killer?: string;
  Victim?: string;
  Attempts?: number;
}

export interface FormattedMuzzleReportSuccessNemesis {
  Killer?: string;
  Victim?: string;
  Kills?: number;
}

export interface FormattedMuzzleReportBackfires {
  User?: string;
  Backfires?: number;
  Muzzles?: number;
  Percentage?: number;
}

export interface FormattedMuzzleReportMuzzled {
  byInstances: FormattedMuzzleReportByInstances[];
}
export interface FormattedMuzzleReport {
  muzzled: FormattedMuzzleReportMuzzled;
  muzzlers: FormattedMuzzleReportMuzzled;
  accuracy: FormattedMuzzleReportAccuracy[];
  KDR: FormattedMuzzleReportKDR[];
  rawNemesis: FormattedMuzzleReportRawNemesis[];
  successNemesis: FormattedMuzzleReportSuccessNemesis[];
  backfires: FormattedMuzzleReportBackfires[];
}
