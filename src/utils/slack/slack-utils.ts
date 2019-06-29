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

export function getUserId(user: string): string {
  const regArray = user.match(userIdRegEx);
  return regArray ? regArray[0].slice(1) : "";
}

export function getUserById(userId: string) {
  return userList.find((user: ISlackUser) => user.id === userId);
}

export function getAllUsers() {
  web.users
    .list()
    .then(resp => {
      userList = resp.users as ISlackUser[];
    })
    .catch(e => {
      console.error("Failed to retrieve users", e);
      console.error("Retrying in 5 seconds");
      setTimeout(() => getAllUsers(), 5000);
    });
}
