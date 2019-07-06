import axios from "axios";
import {
  IChannelResponse,
  ISlackUser
} from "../../shared/models/slack/slack-models";
import { WebClientService } from "../WebClient/web-client.service";

export class SlackService {
  public static getInstance() {
    if (!SlackService.instance) {
      SlackService.instance = new SlackService();
    }
    return SlackService.instance;
  }
  private static instance: SlackService;
  private userIdRegEx = /[<]@\w+/gm;
  private userList: ISlackUser[] = [];
  private web: WebClientService = WebClientService.getInstance();

  private constructor() {}

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

  public getAllUsers() {
    this.web
      .getAllUsers()
      .then(resp => (this.userList = resp.members as ISlackUser[]))
      .catch(e => {
        console.error("Failed to retrieve users", e);
        console.error("Retrying in 5 seconds");
        setTimeout(() => this.getAllUsers(), 5000);
      });
  }
}
