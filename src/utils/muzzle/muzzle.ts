import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  WebClient
} from "@slack/web-api";
import {
  addMuzzleToDb,
  incrementCharacterSuppressions,
  incrementMessageSuppressions,
  incrementMuzzleTime,
  incrementWordSuppressions,
  trackDeletedMessage
} from "../../db/Muzzle/actions/muzzle-actions";
import { IMuzzled, IRequestor } from "../../shared/models/muzzle/muzzle-models";
import { IEventRequest } from "../../shared/models/slack/slack-models";
import {
  containsTag,
  getBotId,
  getUserId,
  getUserIdByCallbackId,
  getUserName
} from "../slack/slack-utils";
import {
  getRemainingTime,
  getTimeString,
  getTimeToMuzzle,
  isRandomEven
} from "./muzzle-utilities";
// Store for the muzzled users.
export const muzzled: Map<string, IMuzzled> = new Map();
// Store for people who are muzzling others.
export const requestors: Map<string, IRequestor> = new Map();

// Muzzle Constants
const MAX_MUZZLE_TIME = 3600000;
const MAX_TIME_BETWEEN_MUZZLES = 3600000;
export const ABUSE_PENALTY_TIME = 300000;
const MAX_SUPPRESSIONS: number = 7;
const MAX_MUZZLES = 2;

export const web: WebClient = new WebClient(process.env.muzzleBotToken);

/**
 * Takes in text and randomly muzzles certain words.
 */
export function muzzle(text: string, muzzleId: number) {
  const replacementText = " ..mMm... ";
  let returnText = "";
  const words = text.split(" ");
  let wordsSuppressed = 0;
  let charactersSuppressed = 0;
  let replacementWord;
  for (const word of words) {
    replacementWord =
      isRandomEven() && !containsTag(word) ? ` *${word}* ` : replacementText;
    if (replacementWord === replacementText) {
      wordsSuppressed++;
      charactersSuppressed += word.length;
    }
    returnText += replacementWord;
  }
  incrementMessageSuppressions(muzzleId);
  incrementCharacterSuppressions(muzzleId, charactersSuppressed);
  incrementWordSuppressions(muzzleId, wordsSuppressed);
  return returnText;
}

/**
 * Adds the specified amount of time to a specified muzzled user.
 */
export function addMuzzleTime(userId: string, timeToAdd: number) {
  if (userId && muzzled.has(userId)) {
    const removalFn = muzzled.get(userId)!.removalFn;
    const newTime = getRemainingTime(removalFn) + timeToAdd;
    const muzzleId = muzzled.get(userId)!.id;
    incrementMuzzleTime(muzzleId, ABUSE_PENALTY_TIME);
    clearTimeout(muzzled.get(userId)!.removalFn);
    console.log(`Setting ${getUserName(userId)}'s muzzle time to ${newTime}`);
    muzzled.set(userId, {
      suppressionCount: muzzled.get(userId)!.suppressionCount,
      muzzledBy: muzzled.get(userId)!.muzzledBy,
      id: muzzled.get(userId)!.id,
      removalFn: setTimeout(() => removeMuzzle(userId), newTime)
    });
  }
}

/**
 * Gets the corresponding database ID for the user's current muzzle.
 */
export function getMuzzleId(userId: string) {
  return muzzled.get(userId)!.id;
}

/**
 * Returns boolean whether max muzzles have been reached.
 */
function isMaxMuzzlesReached(userId: string) {
  return (
    requestors.has(userId) &&
    requestors.get(userId)!.muzzleCount === MAX_MUZZLES
  );
}

/**
 * Returns boolean whether user is muzzled or not.
 */
export function isUserMuzzled(userId: string) {
  return muzzled.has(userId);
}

/**
 * Determines whether or not a bot message should be removed.
 */
export function shouldBotMessageBeMuzzled(request: IEventRequest) {
  let userIdByEventText;
  let userIdByAttachmentText;
  let userIdByAttachmentPretext;
  let userIdByCallbackId;

  if (request.event.text) {
    userIdByEventText = getUserId(request.event.text);
  } else if (request.event.attachments && request.event.attachments.length) {
    userIdByAttachmentText = getUserId(request.event.attachments[0].text);
    userIdByAttachmentPretext = getUserId(request.event.attachments[0].pretext);

    if (request.event.attachments[0].callback_id) {
      userIdByCallbackId = getUserIdByCallbackId(
        request.event.attachments[0].callback_id
      );
    }
  }

  const finalUserId = getBotId(
    userIdByEventText,
    userIdByAttachmentText,
    userIdByAttachmentPretext,
    userIdByCallbackId
  );

  return (
    request.event.subtype === "bot_message" &&
    request.event.attachments &&
    finalUserId &&
    isUserMuzzled(finalUserId) &&
    request.event.username !== "muzzle"
  );
}

/**
 * Adds a requestor to the requestors array with a muzzleCount to track how many muzzles have been performed, as well as a removal function.
 */
function setRequestorCount(requestorId: string) {
  const muzzleCount = requestors.has(requestorId)
    ? ++requestors.get(requestorId)!.muzzleCount
    : 1;

  if (requestors.has(requestorId)) {
    clearTimeout(requestors.get(requestorId)!
      .muzzleCountRemover as NodeJS.Timeout);
  }

  const removalFunction =
    requestors.has(requestorId) &&
    requestors.get(requestorId)!.muzzleCount === MAX_MUZZLES
      ? () => removeRequestor(requestorId)
      : () => decrementMuzzleCount(requestorId);
  requestors.set(requestorId, {
    muzzleCount,
    muzzleCountRemover: setTimeout(removalFunction, MAX_TIME_BETWEEN_MUZZLES)
  });
}

/**
 * Adds a userId to the muzzled array, and sets timeout for removeMuzzle.
 */
function muzzleUser(
  userId: string,
  requestorId: string,
  id: number,
  timeToMuzzle: number
) {
  muzzled.set(userId, {
    suppressionCount: 0,
    muzzledBy: requestorId,
    id,
    removalFn: setTimeout(() => removeMuzzle(userId), timeToMuzzle)
  });
}

/**
 * Adds a user to the muzzled array and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
 */
export function addUserToMuzzled(userId: string, requestorId: string) {
  const userName = getUserName(userId);
  const requestorName = getUserName(requestorId);
  return new Promise(async (resolve, reject) => {
    if (!userId) {
      reject(
        `Invalid username passed in. You can only muzzle existing slack users`
      );
    } else if (isUserMuzzled(userId)) {
      console.error(
        `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`
      );
      reject(`${userName} is already muzzled!`);
    } else if (isUserMuzzled(requestorId)) {
      console.error(
        `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`
      );
      reject(`You can't muzzle someone if you are already muzzled!`);
    } else if (isMaxMuzzlesReached(requestorId)) {
      console.error(
        `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`
      );
      reject(
        `You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`
      );
    } else {
      const timeToMuzzle = getTimeToMuzzle();
      const muzzleFromDb = await addMuzzleToDb(
        requestorId,
        userId,
        timeToMuzzle
      ).catch((e: any) => {
        console.error(e);
        reject(`Muzzle failed!`);
      });

      if (muzzleFromDb) {
        muzzleUser(userId, requestorId, muzzleFromDb.id, timeToMuzzle);
        setRequestorCount(requestorId);
        resolve(
          `Succesfully muzzled ${userName} for ${getTimeString(timeToMuzzle)}`
        );
      }
    }
  });
}
/**
 * Decrements the muzzleCount on a requestor.
 */
export function decrementMuzzleCount(requestorId: string) {
  if (requestors.has(requestorId)) {
    const decrementedMuzzle = --requestors.get(requestorId)!.muzzleCount;
    requestors.set(requestorId, {
      muzzleCount: decrementedMuzzle,
      muzzleCountRemover: requestors.get(requestorId)!.muzzleCountRemover
    });
    console.log(
      `Successfully decremented ${getUserName(
        requestorId
      )} | ${requestorId} muzzleCount to ${decrementedMuzzle}`
    );
  } else {
    console.error(
      `Attemped to decrement muzzle count for ${getUserName(
        requestorId
      )} | ${requestorId} but they did not exist!`
    );
  }
}

/**
 * Removes a requestor from the map.
 */
export function removeRequestor(userId: string) {
  requestors.delete(userId);
  console.log(
    `${MAX_MUZZLE_TIME} has passed since ${getUserName(
      userId
    )} | ${userId} last successful muzzle. They have been removed from requestors.`
  );
}

/**
 * Removes a muzzle from the specified user.
 */
export function removeMuzzle(userId: string) {
  muzzled.delete(userId);
  console.log(
    `Removed ${getUserName(userId)} | ${userId}'s muzzle! He is free at last.`
  );
}

/**
 * Wrapper for sendMessage that handles suppression in memory and, if max suppressions are reached, handles suppression storage to disk.
 */
export function sendMuzzledMessage(
  channel: string,
  userId: string,
  text: string
) {
  const muzzleId = muzzled.get(userId)!.id;
  if (muzzled.get(userId)!.suppressionCount < MAX_SUPPRESSIONS) {
    muzzled.set(userId, {
      suppressionCount: ++muzzled.get(userId)!.suppressionCount,
      muzzledBy: muzzled.get(userId)!.muzzledBy,
      id: muzzleId,
      removalFn: muzzled.get(userId)!.removalFn
    });
    sendMessage(channel, `<@${userId}> says "${muzzle(text, muzzleId)}"`);
  } else {
    trackDeletedMessage(muzzleId, text);
  }
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
