import axios from "axios";
import {
  IChannelResponse,
  ISlackUser
} from "../../shared/models/slack/slack-models";
import { WebService } from "../web/web.service";

export class SlackService {
  public static getInstance() {
    if (!SlackService.instance) {
      SlackService.instance = new SlackService();
    }
    return SlackService.instance;
  }
  private static instance: SlackService;
  public userList: ISlackUser[] = [];
  private userIdRegEx = /[<]@\w+/gm;
  private web: WebService = WebService.getInstance();

  private constructor() {}

  public sendResponse(responseUrl: string, response: IChannelResponse): void {
    axios
      .post(responseUrl, response)
      .catch((e: Error) =>
        console.error(`Error responding: ${e.message} at ${responseUrl}`)
      );
  }

  /**
   * Gets the username of the user by id.
   */
  public getUserName(userId: string): string {
    const userObj: ISlackUser | undefined = this.getUserById(userId);
    return userObj ? userObj.name : "";
  }

  /**
   * Retrieves the user id from a string.
   * Expected format is <@U235KLKJ>
   */
  public getUserId(user: string) {
    if (!user) {
      return "";
    }
    const regArray = user.match(this.userIdRegEx);
    return regArray ? regArray[0].slice(2) : "";
  }

  /**
   * Returns the user object by id
   */
  public getUserById(userId: string) {
    return this.userList.find((user: ISlackUser) => user.id === userId);
  }

  /**
   * Kind of a janky way to get the requesting users ID via callback id.
   */
  public getUserIdByCallbackId(callbackId: string) {
    if (callbackId.includes("_")) {
      return callbackId.slice(callbackId.indexOf("_") + 1, callbackId.length);
    } else {
      return "";
    }
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
  public containsTag(text: string | undefined): boolean {
    if (!text) {
      return false;
    }

    return (
      text.includes("<!channel>") ||
      text.includes("<!here>") ||
      !!this.getUserId(text)
    );
  }

  /**
   * Retrieves a list of all users.
   */
  public async getAllUsers() {
    console.log("Retrieving new user list...");
    this.userList = (await this.web
      .getAllUsers()
      .then(resp => {
        console.log("New user list has been retrieved!");
        return resp.members as ISlackUser[];
      })
      .catch(e => {
        console.error("Failed to retrieve users", e);
        console.error("Retrying in 5 seconds...");
        setTimeout(() => this.getAllUsers(), 5000);
      })) as ISlackUser[];
  }
}
