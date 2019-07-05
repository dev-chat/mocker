import { getRepository } from "typeorm";
import { Muzzle } from "../models/Muzzle";

export function addMuzzleTransaction(
  requestorId: string,
  muzzleId: string,
  time: number
) {
  const transaction = new Muzzle();
  transaction.requestorId = requestorId;
  transaction.muzzledId = muzzleId;
  transaction.messagesSuppressed = 0;
  transaction.wordsSuppressed = 0;
  transaction.charactersSuppressed = 0;
  transaction.milliseconds = time;
  return getRepository(Muzzle).save(transaction);
}

export function incrementMuzzleTime(transactionId: number, ms: number) {
  return getRepository(Muzzle).increment(
    { id: transactionId },
    "milliseconds",
    ms
  );
}

export function incrementMessageSuppressions(transactionId: number) {
  return getRepository(Muzzle).increment(
    { id: transactionId },
    "messagesSuppressed",
    1
  );
}

export function incrementWordSuppressions(
  transactionId: number,
  wordSuppressions: number
) {
  return getRepository(Muzzle).increment(
    {
      id: transactionId
    },
    "wordsSuppressed",
    wordSuppressions
  );
}

export function incrementCharacterSuppressions(
  transactionId: number,
  charactersSuppressed: number
) {
  return getRepository(Muzzle).increment(
    {
      id: transactionId
    },
    "charactersSuppressed",
    charactersSuppressed
  );
}
