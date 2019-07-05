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

export function getAllMuzzleTransactions() {
  return getRepository(Muzzle).find();
}

export function getAllMuzzlesByMuzzleId(muzzleId: string) {
  return getRepository(Muzzle).find({ muzzledId: muzzleId });
}

export function getAllMuzzlesByRequestorId(requestorId: string) {
  return getRepository(Muzzle).find({ requestorId });
}

export function getMostMuzzled() {
  return "test";
}

export function getMostMuzzledByMessageSuppression() {
  return getRepository(Muzzle)
    .createQueryBuilder()
    .where("");
}

export function getMostMuzzledByWordSuppression() {
  return "test";
}

export function getMostMuzzledByCharacterSuppression() {
  return "test";
}

export function getMostMuzzledByDate(date: Date) {
  console.log(date);
  return "test";
}

export function getMostMuzzledByDateRange(startDate: Date, endDate: Date) {
  console.log(startDate, endDate);
  return "test";
}

export function incrementMessageSuppressions(muzzleId: number) {
  return getRepository(Muzzle).increment(
    { id: muzzleId },
    "messagesSuppressed",
    1
  );
}

export function updateSuppressions(
  muzzleId: number,
  wordsSuppressed: number,
  charactersSuppressed: number
) {
  console.log("should update suppressions for: ", muzzleId);
  console.log("wordsSuppressed", wordsSuppressed);
  console.log("charactersSuppressed", charactersSuppressed);
  return getRepository(Muzzle).update(
    { id: muzzleId },
    {
      wordsSuppressed,
      charactersSuppressed
    }
  );
}
