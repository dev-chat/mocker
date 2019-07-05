import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  WebClient
} from "@slack/web-api";

class WebClientService {
  private web: WebClient = new WebClient(process.env.muzzleBotToken);

  /**
   * Handles deletion of messages.
   */
  public deleteMessage(channel: string, ts: string) {
    const muzzleToken: any = process.env.muzzleBotToken;
    const deleteRequest: ChatDeleteArguments = {
      token: muzzleToken,
      channel,
      ts,
      as_user: true
    };

    this.web.chat.delete(deleteRequest).catch(e => {
      if (e.data.error === "message_not_found") {
        console.log("Message already deleted, no need to retry");
      } else {
        console.error(e);
        console.error("Retrying in 5 seconds...");
        setTimeout(() => this.deleteMessage(channel, ts), 5000);
      }
    });
  }

  /**
   * Handles sending messages to the chat.
   */
  public sendMessage(channel: string, text: string) {
    const muzzleToken: any = process.env.muzzleBotToken;
    const postRequest: ChatPostMessageArguments = {
      token: muzzleToken,
      channel,
      text
    };
    this.web.chat.postMessage(postRequest).catch(e => console.error(e));
  }

  public getAllUsers() {
    return this.web.users.list();
  }
}

export const WebClientSingleton: WebClientService = new WebClientService();
