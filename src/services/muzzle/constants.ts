export const MAX_MUZZLE_TIME = 3600000;
export const MAX_TIME_BETWEEN_MUZZLES = 3600;
export const MAX_SUPPRESSIONS = 7;
export const MAX_MUZZLES = 2;
export const ABUSE_PENALTY_TIME = 300000;
export const REPLACEMENT_TEXT = ['..mMm..', '..COUGH..'];
export const MAX_WORD_LENGTH = 10;
export const USER_REGEX = /[<]@\w+/gm;
export enum MuzzleRedisTypeEnum {
  'Muzzled' = 'muzzled',
  'Requestor' = 'requestor',
}
