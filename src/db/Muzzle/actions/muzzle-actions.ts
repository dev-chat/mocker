import { getRepository } from "typeorm";
import { Muzzle } from "../models/Muzzle";

export function addMuzzleToDb(
  requestorId: string,
  muzzledId: string,
  time: number
) {
  const muzzle = new Muzzle();
  muzzle.requestorId = requestorId;
  muzzle.muzzledId = muzzledId;
  muzzle.messagesSuppressed = 0;
  muzzle.wordsSuppressed = 0;
  muzzle.charactersSuppressed = 0;
  muzzle.milliseconds = time;
  return getRepository(Muzzle).save(muzzle);
}

export function incrementMuzzleTime(id: number, ms: number) {
  return getRepository(Muzzle).increment({ id }, "milliseconds", ms);
}

export function incrementMessageSuppressions(id: number) {
  return getRepository(Muzzle).increment({ id }, "messagesSuppressed", 1);
}

export function incrementWordSuppressions(id: number, suppressions: number) {
  return getRepository(Muzzle).increment(
    { id },
    "wordsSuppressed",
    suppressions
  );
}

export function incrementCharacterSuppressions(
  id: number,
  charactersSuppressed: number
) {
  return getRepository(Muzzle).increment(
    { id },
    "charactersSuppressed",
    charactersSuppressed
  );
}

/**
 * Determines suppression counts for messages that are ONLY deleted and not muzzled.
 * Used when a muzzled user has hit their max suppressions or when they have tagged channel.
 */
export function trackDeletedMessage(muzzleId: number, text: string) {
  const words = text.split(" ").length;
  const characters = text.split("").length;
  incrementMessageSuppressions(muzzleId);
  incrementWordSuppressions(muzzleId, words);
  incrementCharacterSuppressions(muzzleId, characters);
}
