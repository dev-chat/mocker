import { IMuzzled, IRequestor } from "../../shared/models/muzzle/muzzle-models";
import { IEventRequest } from "../../shared/models/slack/slack-models";
import { SlackService } from "../slack/slack.service";
import { WebService } from "../web/web.service";
import {
  ABUSE_PENALTY_TIME,
  MAX_MUZZLE_TIME,
  MAX_MUZZLES,
  MAX_SUPPRESSIONS,
  MAX_TIME_BETWEEN_MUZZLES
} from "./constants";
import {
  getRemainingTime,
  getTimeString,
  getTimeToMuzzle,
  isRandomEven,
  shouldBackfire
} from "./muzzle-utilities";
import { MuzzlePersistenceService } from "./muzzle.persistence.service";

export class MuzzleService {
  public static getInstance() {
    if (!MuzzleService.instance) {
      MuzzleService.instance = new MuzzleService();
    }
    return MuzzleService.instance;
  }

  private static instance: MuzzleService;
  private webService = WebService.getInstance();
  private slackService = SlackService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private muzzled: Map<string, IMuzzled> = new Map();
  private requestors: Map<string, IRequestor> = new Map();

  private constructor() {}
  /**
   * Takes in text and randomly muzzles certain words.
   */
  public muzzle(text: string, muzzleId: number, isBackfire: boolean) {
    const replacementText = " ..mMm.. ";
    let returnText = "";
    const words = text.split(" ");
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;
    let replacementWord;
    for (const word of words) {
      replacementWord =
        isRandomEven() &&
        word.length < 10 &&
        !this.slackService.containsTag(word)
          ? ` *${word}* `
          : replacementText;
      if (replacementWord === replacementText) {
        wordsSuppressed++;
        charactersSuppressed += word.length;
      }
      returnText += replacementWord;
    }
    this.muzzlePersistenceService.incrementMessageSuppressions(
      muzzleId,
      isBackfire
    );
    this.muzzlePersistenceService.incrementCharacterSuppressions(
      muzzleId,
      charactersSuppressed,
      isBackfire
    );
    this.muzzlePersistenceService.incrementWordSuppressions(
      muzzleId,
      wordsSuppressed,
      isBackfire
    );
    return returnText;
  }
  /**
   * Adds the specified amount of time to a specified muzzled user.
   */
  public addMuzzleTime(userId: string, timeToAdd: number, isBackfire: boolean) {
    if (userId && this.muzzled.has(userId)) {
      const removalFn = this.muzzled.get(userId)!.removalFn;
      const newTime = getRemainingTime(removalFn) + timeToAdd;
      const muzzleId = this.muzzled.get(userId)!.id;
      this.muzzlePersistenceService.incrementMuzzleTime(
        muzzleId,
        ABUSE_PENALTY_TIME,
        isBackfire
      );
      clearTimeout(this.muzzled.get(userId)!.removalFn);
      console.log(
        `Setting ${this.slackService.getUserName(
          userId
        )}'s muzzle time to ${newTime}`
      );
      this.muzzled.set(userId, {
        suppressionCount: this.muzzled.get(userId)!.suppressionCount,
        muzzledBy: this.muzzled.get(userId)!.muzzledBy,
        id: this.muzzled.get(userId)!.id,
        isBackfire: this.muzzled.get(userId)!.isBackfire,
        removalFn: setTimeout(() => this.removeMuzzle(userId), newTime)
      });
    }
  }
  /**
   * Gets the corresponding database ID for the user's current muzzle.
   */
  public getMuzzleId(userId: string) {
    return this.muzzled.get(userId)!.id;
  }

  /**
   * Retrieves whether or not a muzzle is backfired.
   */
  public getIsBackfire(userId: string) {
    return this.muzzled.has(userId) && this.muzzled.get(userId)!.isBackfire;
  }

  /**
   * Retrieves the specified user from the muzzled map by slack id.
   */
  public getMuzzledUserById(slackId: string) {
    return this.muzzled.get(slackId);
  }

  /**
   * Retrieves the specified user from the requestors map by slack id.
   */
  public getRequestorById(slackId: string) {
    return this.requestors.get(slackId);
  }

  /**
   * Returns boolean whether user is muzzled or not.
   */
  public isUserMuzzled(userId: string) {
    return this.muzzled.has(userId);
  }

  /**
   * Returns boolean whether user is a requestor or not.
   */
  public isUserRequestor(userId: string) {
    return this.requestors.has(userId);
  }
  /**
   * Determines whether or not a bot message should be removed.
   */
  public shouldBotMessageBeMuzzled(request: IEventRequest) {
    let userIdByEventText;
    let userIdByAttachmentText;
    let userIdByAttachmentPretext;
    let userIdByCallbackId;

    if (request.event.text) {
      userIdByEventText = this.slackService.getUserId(request.event.text);
    }

    if (request.event.attachments && request.event.attachments.length) {
      userIdByAttachmentText = this.slackService.getUserId(
        request.event.attachments[0].text
      );
      userIdByAttachmentPretext = this.slackService.getUserId(
        request.event.attachments[0].pretext
      );

      if (request.event.attachments[0].callback_id) {
        userIdByCallbackId = this.slackService.getUserIdByCallbackId(
          request.event.attachments[0].callback_id
        );
      }
    }

    const finalUserId = this.slackService.getBotId(
      userIdByEventText,
      userIdByAttachmentText,
      userIdByAttachmentPretext,
      userIdByCallbackId
    );

    return !!(
      request.event.subtype === "bot_message" &&
      finalUserId &&
      this.isUserMuzzled(finalUserId) &&
      request.event.username !== "muzzle"
    );
  }

  /**
   * Adds a user to the muzzled map and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
   */
  public addUserToMuzzled(
    userId: string,
    requestorId: string,
    channel: string
  ) {
    const shouldBackFire = shouldBackfire();
    const userName = this.slackService.getUserName(userId);
    const requestorName = this.slackService.getUserName(requestorId);
    return new Promise(async (resolve, reject) => {
      if (!userId) {
        reject(
          `Invalid username passed in. You can only muzzle existing slack users`
        );
      } else if (this.isUserMuzzled(userId)) {
        console.error(
          `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`
        );
        reject(`${userName} is already muzzled!`);
      } else if (this.isUserMuzzled(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`
        );
        reject(`You can't muzzle someone if you are already muzzled!`);
      } else if (this.isMaxMuzzlesReached(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`
        );
        reject(
          `You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`
        );
      } else if (shouldBackFire) {
        console.log(
          `Backfiring on ${requestorName} | ${requestorId} for attempting to muzzle ${userName} | ${userId}`
        );
        const timeToMuzzle = getTimeToMuzzle();
        const backfireFromDb = await this.muzzlePersistenceService
          .addBackfireToDb(requestorId, timeToMuzzle)
          .catch((e: any) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });

        if (backfireFromDb) {
          this.backfireUser(requestorId, backfireFromDb.id, timeToMuzzle);
          this.setRequestorCount(requestorId);
          this.webService.sendMessage(
            channel,
            `:boom: <@${requestorId}> attempted to muzzle <@${userId}> but it backfired! :boom:`
          );
          resolve(`:boom: Backfired! Better luck next time... :boom:`);
        }
      } else {
        const timeToMuzzle = getTimeToMuzzle();
        const muzzleFromDb = await this.muzzlePersistenceService
          .addMuzzleToDb(requestorId, userId, timeToMuzzle)
          .catch((e: any) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });

        if (muzzleFromDb) {
          this.muzzleUser(userId, requestorId, muzzleFromDb.id, timeToMuzzle);
          this.setRequestorCount(requestorId);
          resolve(
            `Successfully muzzled ${userName} for ${getTimeString(
              timeToMuzzle
            )}`
          );
        }
      }
    });
  }

  /**
   * Wrapper for sendMessage that handles suppression in memory and, if max suppressions are reached, handles suppression storage to disk.
   */
  public sendMuzzledMessage(channel: string, userId: string, text: string) {
    const muzzleId = this.muzzled.get(userId)!.id;
    const isBackfire = this.muzzled.get(userId)!.isBackfire;
    if (this.muzzled.get(userId)!.suppressionCount < MAX_SUPPRESSIONS) {
      this.muzzled.set(userId, {
        suppressionCount: ++this.muzzled.get(userId)!.suppressionCount,
        muzzledBy: this.muzzled.get(userId)!.muzzledBy,
        id: muzzleId,
        isBackfire,
        removalFn: this.muzzled.get(userId)!.removalFn
      });
      this.webService.sendMessage(
        channel,
        `<@${userId}> says "${this.muzzle(text, muzzleId, isBackfire)}"`
      );
    } else {
      this.muzzlePersistenceService.trackDeletedMessage(
        muzzleId,
        text,
        isBackfire
      );
    }
  }

  /**
   * Decrements the muzzleCount on a requestor.
   */
  private decrementMuzzleCount(requestorId: string) {
    if (this.requestors.has(requestorId)) {
      const decrementedMuzzle = --this.requestors.get(requestorId)!.muzzleCount;
      this.requestors.set(requestorId, {
        muzzleCount: decrementedMuzzle,
        muzzleCountRemover: this.requestors.get(requestorId)!.muzzleCountRemover
      });
      console.log(
        `Successfully decremented ${this.slackService.getUserName(
          requestorId
        )} | ${requestorId} muzzleCount to ${decrementedMuzzle}`
      );
    } else {
      console.error(
        `Attemped to decrement muzzle count for ${this.slackService.getUserName(
          requestorId
        )} | ${requestorId} but they did not exist!`
      );
    }
  }

  /**
   * Removes a muzzle from the specified user.
   */
  private removeMuzzle(userId: string) {
    this.muzzled.delete(userId);
    console.log(
      `Removed ${this.slackService.getUserName(
        userId
      )} | ${userId}'s muzzle! He is free at last.`
    );
  }

  /**
   * Adds a userId to the muzzled map, and sets timeout for removeMuzzle.
   */
  private muzzleUser(
    userId: string,
    requestorId: string,
    id: number,
    timeToMuzzle: number
  ) {
    this.muzzled.set(userId, {
      suppressionCount: 0,
      muzzledBy: requestorId,
      id,
      isBackfire: false,
      removalFn: setTimeout(() => this.removeMuzzle(userId), timeToMuzzle)
    });
  }

  private backfireUser(userId: string, id: number, timeToMuzzle: number) {
    this.muzzled.set(userId, {
      suppressionCount: 0,
      muzzledBy: userId,
      id,
      isBackfire: true,
      removalFn: setTimeout(() => this.removeMuzzle(userId), timeToMuzzle)
    });
  }

  /**
   * Removes a requestor from the map.
   */
  private removeRequestor(userId: string) {
    this.requestors.delete(userId);
    console.log(
      `${MAX_MUZZLE_TIME} has passed since ${this.slackService.getUserName(
        userId
      )} | ${userId} last successful muzzle. They have been removed from requestors.`
    );
  }
  /**
   * Adds a requestor to the requestors map with a muzzleCount to track how many muzzles have been performed, as well as a removal function.
   */
  private setRequestorCount(requestorId: string) {
    const muzzleCount = this.requestors.has(requestorId)
      ? ++this.requestors.get(requestorId)!.muzzleCount
      : 1;

    if (this.requestors.has(requestorId)) {
      clearTimeout(this.requestors.get(requestorId)!
        .muzzleCountRemover as NodeJS.Timeout);
    }

    const removalFunction =
      this.requestors.has(requestorId) &&
      this.requestors.get(requestorId)!.muzzleCount === MAX_MUZZLES
        ? () => this.removeRequestor(requestorId)
        : () => this.decrementMuzzleCount(requestorId);
    this.requestors.set(requestorId, {
      muzzleCount,
      muzzleCountRemover: setTimeout(removalFunction, MAX_TIME_BETWEEN_MUZZLES)
    });
  }

  /**
   * Returns boolean whether max muzzles have been reached.
   */
  private isMaxMuzzlesReached(userId: string) {
    return (
      this.requestors.has(userId) &&
      this.requestors.get(userId)!.muzzleCount === MAX_MUZZLES
    );
  }
}
