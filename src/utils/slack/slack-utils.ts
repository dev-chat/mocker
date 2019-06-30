import axios from "axios";
import {
  IChannelResponse,
  ISlackUser
} from "../../shared/models/slack/slack-models";
import { web } from "../muzzle/muzzle-utils";

const userIdRegEx = /@\w+/gm;

export let userList: ISlackUser[];

export function sendResponse(
  responseUrl: string,
  response: IChannelResponse
): void {
  axios
    .post(responseUrl, response)
    .then(() =>
      console.log(`Successfully responded to: ${responseUrl}`, response)
    )
    .catch((e: Error) =>
      console.error(`Error responding: ${e.message} at ${responseUrl}`)
    );
}

export function getUserName(user: string): string {
  const userObj: ISlackUser | undefined = getUserById(user);
  return userObj ? userObj.name : "";
}

export function getUserId(user: string) {
  if (!user) {
    return undefined;
  }
  const regArray = user.match(userIdRegEx);
  return regArray ? regArray[0].slice(1) : undefined;
}

export function getUserById(userId: string) {
  return userList.find((user: ISlackUser) => user.id === userId);
}

// This will really only work for SpoilerBot since it stores userId here and nowhere else.
export function getUserIdByCallbackId(callbackId: string) {
  return callbackId.slice(callbackId.indexOf("_") + 1, callbackId.length);
}

/**
 * TO BE USED EXCLUSIVELY FOR TESTING. WE SHOULD *NEVER* be setting the userList manually
 * This should be handled by getAllUsers() only.
 */
export function setUserList(list: ISlackUser[]) {
  userList = list;
}

export function getAllUsers() {
  web.users
    .list()
    .then(resp => {
      userList = resp.members as ISlackUser[];
    })
    .catch(e => {
      console.error("Failed to retrieve users", e);
      console.error("Retrying in 5 seconds");
      setTimeout(() => getAllUsers(), 5000);
    });
}
