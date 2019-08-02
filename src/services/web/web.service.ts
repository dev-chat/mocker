import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebClient
} from "@slack/web-api";

export class WebService {
  public static getInstance() {
    if (!WebService.instance) {
      WebService.instance = new WebService();
    }
    return WebService.instance;
  }
  private static instance: WebService;
  private web: WebClient = new WebClient(process.env.muzzleBotToken);

  private constructor() {}

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

  public uploadFile(channel: string, content: string, title?: string) {
    const muzzleToken: any = process.env.muzzleBotUserToken;
    const uploadRequest: FilesUploadArguments = {
      channels: channel,
      content,
      filetype: "markdown",
      title: "Muzzle Report",
      initial_comment: title,
      token: muzzleToken
    };

    this.web.files
      .upload(uploadRequest)
      .then(result => console.log(result))
      .catch(e => console.error(e));
  }
}
