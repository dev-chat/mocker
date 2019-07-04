import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  WebClient
} from "@slack/web-api";
import { addMuzzleTransaction } from "../../db/Muzzle/actions/muzzle-actions";
import { IMuzzled, IMuzzler } from "../../shared/models/muzzle/muzzle-models";
import { IEventRequest } from "../../shared/models/slack/slack-models";
import {
  getUserId,
  getUserIdByCallbackId,
  getUserName
} from "../slack/slack-utils";
// Store for the muzzled users.
export const muzzled: Map<string, IMuzzled> = new Map();
// Store for people who are muzzling others.
export const requestors: Map<string, IMuzzler> = new Map();

// Time period in which a user must wait before making more muzzles.
const MAX_MUZZLE_TIME = 3600000;
const MAX_TIME_BETWEEN_MUZZLES = 3600000;
export const ABUSE_PENALTY_TIME = 300000;
const MAX_SUPPRESSIONS: number = 7;
const MAX_MUZZLES = 2;

export const web: WebClient = new WebClient(process.env.muzzleBotToken);

/**
 * Takes in text and randomly muzzles certain words.
 */
export function muzzle(text: string) {
  let returnText = "";
  const words = text.split(" ");
  for (const word of words) {
    returnText +=
      isRandomEven() && !containsTag(word) ? ` *${word}* ` : " ..mMm.. ";
  }
  return returnText;
}

export function addMuzzleTime(userId: string) {
  if (userId && muzzled.has(userId)) {
    const removalFn = muzzled.get(userId)!.removalFn;
    const newTime = getRemainingTime(removalFn) + ABUSE_PENALTY_TIME;
    clearTimeout(muzzled.get(userId)!.removalFn);
    console.log(`Setting ${getUserName(userId)}'s muzzle time to ${newTime}`);
    muzzled.set(userId, {
      suppressionCount: muzzled.get(userId)!.suppressionCount,
      muzzledBy: muzzled.get(userId)!.muzzledBy,
      removalFn: setTimeout(() => removeMuzzle(userId), newTime)
    });
  }
}

function getRemainingTime(timeout: any) {
  return Math.ceil(
    timeout._idleStart + timeout._idleTimeout - process.uptime() * 1000
  );
}

/**
 * Determines whether or not a user is trying to @user, @channel or @here while muzzled.
 */
export function containsTag(word: string): boolean {
  return !!getUserId(word) || word === "<!channel>" || word === "<!here>";
}

/**
 * Gives us a random value between 30 seconds and 3 minutes.
 */
export function getTimeToMuzzle() {
  return Math.floor(Math.random() * (180000 - 30000 + 1) + 30000);
}

/**
 * Gives us a time string formatted as 1m20s to show the user.
 */
export function getTimeString(time: number) {
  const minutes = Math.floor(time / 60000);
  const seconds = ((time % 60000) / 1000).toFixed(0);
  return +seconds === 60
    ? minutes + 1 + "m00s"
    : minutes + "m" + (+seconds < 10 ? "0" : "") + seconds + "s";
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

function getBotId(
  fromText: string | undefined,
  fromAttachmentText: string | undefined,
  fromPretext: string | undefined,
  fromCallbackId: string | undefined
) {
  return fromText || fromAttachmentText || fromPretext || fromCallbackId;
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
 * Adds a requestor to the requestors array with a muzzleCount to track how many muzzles have been performed, as well as a removal funciton.
 */
function setMuzzlerCount(requestorId: string) {
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
      ? () => removeMuzzler(requestorId)
      : () => decrementMuzzleCount(requestorId);
  requestors.set(requestorId, {
    muzzleCount,
    muzzleCountRemover: setTimeout(removalFunction, MAX_TIME_BETWEEN_MUZZLES)
  });
}

/**
 * Adds a userId to the muzzled array, and sets timeout for removeMuzzle.
 */
function muzzleUser(userId: string, requestorId: string, timeToMuzzle: number) {
  muzzled.set(userId, {
    suppressionCount: 0,
    muzzledBy: requestorId,
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
      muzzleUser(userId, requestorId, timeToMuzzle);
      setMuzzlerCount(requestorId);
      try {
        await addMuzzleTransaction(requestorId, userId, timeToMuzzle);
        resolve(`Successfully muzzled ${userName}!`);
      } catch (e) {
        console.error(e);
        reject(`Unable to add Muzzle to DB`);
      }
    }
  });
}

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

export function removeMuzzler(userId: string) {
  requestors.delete(userId);
  console.log(
    `${MAX_MUZZLE_TIME} has passed since ${getUserName(
      userId
    )} | ${userId} last successful muzzle. They have been removed from requestors.`
  );
}

export function removeMuzzle(userId: string) {
  muzzled.delete(userId);
  console.log(
    `Removed ${getUserName(userId)} | ${userId}'s muzzle! He is free at last.`
  );
}

export function isRandomEven() {
  return Math.floor(Math.random() * 2) % 2 === 0;
}

export function sendMuzzledMessage(
  channel: string,
  userId: string,
  text: string
) {
  if (muzzled.get(userId)!.suppressionCount < MAX_SUPPRESSIONS) {
    muzzled.set(userId, {
      suppressionCount: ++muzzled.get(userId)!.suppressionCount,
      muzzledBy: muzzled.get(userId)!.muzzledBy,
      removalFn: muzzled.get(userId)!.removalFn
    });
    sendMessage(channel, `<@${userId}> says "${muzzle(text)}"`);
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
