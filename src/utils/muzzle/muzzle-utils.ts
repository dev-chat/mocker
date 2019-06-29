import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  WebClient
} from "@slack/web-api";
import { IMuzzled, IMuzzler } from "../../shared/models/muzzle/muzzle-models";
import { getUserName } from "../slack/slack-utils";
// Store for the muzzled users.
export const muzzled: Map<string, IMuzzled> = new Map();
// Store for people who are muzzling others.
export const muzzlers: Map<string, IMuzzler> = new Map();

// Time period in which a user must wait before making more muzzles.
const MAX_MUZZLE_TIME = 3600000;
const MAX_TIME_BETWEEN_MUZZLES = 3600000;
export const MAX_MUZZLES = 2;

export const web: WebClient = new WebClient(process.env.muzzleBotToken);

/**
 * Takes in text and randomly muzzles certain words.
 */
export function muzzle(text: string) {
  let returnText = "";
  const words = text.split(" ");
  for (const word of words) {
    returnText +=
      isRandomEven() && !containsAt(word) ? ` *${word}* ` : " ..mMm.. ";
  }
  return returnText;
}

/**
 * Determines whether or not a user is trying to @ someone while muzzled or @ channel.
 */
export function containsAt(word: string): boolean {
  return word.includes("@") || word.includes("<!channel>");
}

/**
 * Adds a user to the muzzled array and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
 */
export function addUserToMuzzled(userId: string, requestorId: string) {
  const userName = getUserName(userId);
  const requestorName = getUserName(requestorId);
  return new Promise((resolve, reject) => {
    const timeToMuzzle = Math.floor(
      Math.random() * (180000 - 30000 + 1) + 30000
    );
    const minutes = Math.floor(timeToMuzzle / 60000);
    const seconds = ((timeToMuzzle % 60000) / 1000).toFixed(0);
    if (muzzled.has(userId)) {
      console.error(
        `${requestorName} attempted to muzzle ${userName} but ${userName} is already muzzled.`
      );
      reject(`${userName} is already muzzled!`);
    } else if (muzzled.has(requestorName)) {
      console.error(
        `User: ${requestorName} attempted to muzzle ${userName} but failed because requestor: ${requestorName} is currently muzzled`
      );
      reject(`You can't muzzle someone if you are already muzzled!`);
    } else if (
      muzzlers.has(requestorId) &&
      muzzlers.get(requestorId)!.muzzleCount === MAX_MUZZLES
    ) {
      console.error(
        `User: ${requestorName} attempted to muzzle ${userName} but failed because requestor: ${requestorName} has reached maximum muzzle of ${MAX_MUZZLES}`
      );
      reject(
        `You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`
      );
    } else {
      // Add a newly muzzled user.
      muzzled.set(userId, {
        suppressionCount: 0,
        muzzledBy: requestorId
      });
      const muzzleCount = muzzlers.has(requestorId)
        ? ++muzzlers.get(requestorId)!.muzzleCount
        : 1;
      // Add requestor to muzzlers
      muzzlers.set(requestorId, {
        muzzleCount,
        muzzleCountRemover: setTimeout(
          () => decrementMuzzleCount(requestorId),
          MAX_TIME_BETWEEN_MUZZLES
        )
      });

      if (
        muzzlers.has(requestorId) &&
        muzzlers.get(requestorId)!.muzzleCountRemover
      ) {
        const currentTimer = muzzlers.get(requestorId)!.muzzleCountRemover;
        clearTimeout(currentTimer as NodeJS.Timeout);
        const removalFunction =
          muzzlers.get(requestorId)!.muzzleCount === MAX_MUZZLES
            ? () => removeMuzzler(requestorId)
            : () => decrementMuzzleCount(requestorId);
        muzzlers.set(requestorId, {
          muzzleCount: muzzlers.get(requestorId)!.muzzleCount,
          muzzleCountRemover: setTimeout(removalFunction, MAX_MUZZLE_TIME)
        });
      }
      console.log(
        `${userName} is now muzzled for ${timeToMuzzle} milliseconds`
      );
      setTimeout(() => removeMuzzle(userId), timeToMuzzle);
      resolve(
        `Succesfully muzzled ${userName} for ${
          +seconds === 60
            ? minutes + 1 + "m00s"
            : minutes + "m" + (+seconds < 10 ? "0" : "") + seconds + "s"
        } minutes`
      );
    }
  });
}

export function decrementMuzzleCount(requestorId: string) {
  if (muzzlers.has(requestorId)) {
    const decrementedMuzzle = --muzzlers.get(requestorId)!.muzzleCount;
    muzzlers.set(requestorId, {
      muzzleCount: decrementedMuzzle,
      muzzleCountRemover: muzzlers.get(requestorId)!.muzzleCountRemover
    });
    console.log(
      `Successfully decremented ${requestorId} muzzleCount to ${decrementedMuzzle}`
    );
  } else {
    console.error(
      `Attemped to decrement muzzle count for ${requestorId} but they did not exist!`
    );
  }
}

export function removeMuzzler(user: string) {
  muzzlers.delete(user);
  console.log(
    `${MAX_MUZZLE_TIME} has passed since ${user} last successful muzzle. They have been removed from muzzlers.`
  );
}

export function removeMuzzle(user: string) {
  muzzled.delete(user);
  console.log(`Removed ${user}'s muzzle! He is free at last.`);
}

export function isRandomEven() {
  return Math.floor(Math.random() * 2) % 2 === 0;
}
/**
 * Handles deletion of messages.
 */
export function deleteMessage(channel: string, ts: string) {
  const muzzleToken: any = process.env.muzzleBotToken;
  const deleteRequest: ChatDeleteArguments = {
    token: muzzleToken,
    channel,
    ts,
    as_user: true
  };

  web.chat.delete(deleteRequest).catch(e => {
    if (e.data.error === "message_not_found") {
      console.log("Message already deleted, no need to retry");
    } else {
      console.error(e);
      console.error("Retrying in 5 seconds...");
      setTimeout(() => deleteMessage(channel, ts), 5000);
    }
  });
}

/**
 * Handles sending messages to the chat.
 */
export function sendMessage(channel: string, text: string) {
  const muzzleToken: any = process.env.muzzleBotToken;
  const postRequest: ChatPostMessageArguments = {
    token: muzzleToken,
    channel,
    text
  };
  web.chat.postMessage(postRequest).catch(e => console.error(e));
}
