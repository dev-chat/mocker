import axios from "axios";
import {
  IChannelResponse,
  ISlackUser
} from "../../shared/models/slack/slack-models";

export class SlackService {
  private userIdRegEx = /[<]@\w+/gm;
  private userList: ISlackUser[] = [];

  public sendResponse(responseUrl: string, response: IChannelResponse): void {
    axios
      .post(responseUrl, response)
      .then(() =>
        console.log(`Successfully responded to: ${responseUrl}`, response)
      )
      .catch((e: Error) =>
        console.error(`Error responding: ${e.message} at ${responseUrl}`)
      );
  }

  public getUserName(user: string): string {
    const userObj: ISlackUser | undefined = this.getUserById(user);
    return userObj ? userObj.name : "";
  }

  public getUserId(user: string) {
    if (!user) {
      return "";
    }
    const regArray = user.match(this.userIdRegEx);
    return regArray ? regArray[0].slice(2) : "";
  }

  public getUserById(userId: string) {
    return this.userList.find((user: ISlackUser) => user.id === userId);
  }

  // This will really only work for SpoilerBot since it stores userId here and nowhere else.
  public getUserIdByCallbackId(callbackId: string) {
    return callbackId.slice(callbackId.indexOf("_") + 1, callbackId.length);
  }
  /**
   * Retrieves a Slack user id from the various fields in which a userId can exist inside of a bot response.
   */
  public getBotId(
    fromText: string | undefined,
    fromAttachmentText: string | undefined,
    fromPretext: string | undefined,
    fromCallbackId: string | undefined
  ) {
    return fromText || fromAttachmentText || fromPretext || fromCallbackId;
  }
  /**
   * Determines whether or not a user is trying to @user, @channel or @here while muzzled.
   */
  public containsTag(text: string): boolean {
    return (
      text.includes("<!channel>") ||
      text.includes("<!here>") ||
      !!this.getUserId(text)
    );
  }
}
