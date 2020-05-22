import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebAPICallResult,
  WebClient,
} from '@slack/web-api';

export class WebService {
  public static getInstance(): WebService {
    if (!WebService.instance) {
      WebService.instance = new WebService();
    }
    return WebService.instance;
  }
  private static instance: WebService;
  private web: WebClient = new WebClient(process.env.MUZZLE_BOT_TOKEN);

  /**
   * Handles deletion of messages.
   */
  public deleteMessage(channel: string, ts: string): void {
    const muzzleToken: string | undefined = process.env.MUZZLE_BOT_TOKEN;
    const deleteRequest: ChatDeleteArguments = {
      token: muzzleToken,
      channel,
      ts,
      // eslint-disable-next-line @typescript-eslint/camelcase
      as_user: true,
    };

    this.web.chat.delete(deleteRequest).catch(e => {
      if (e.data.error === 'message_not_found') {
        console.log('Message already deleted, no need to retry');
      } else {
        console.error(e);
        console.error('Unable to delete message. Retrying in 5 seconds...');
        setTimeout(() => this.deleteMessage(channel, ts), 5000);
      }
    });
  }

  /**
   * Handles sending messages to the chat.
   */
  public sendMessage(channel: string, text: string): void {
    const token: string | undefined = process.env.MUZZLE_BOT_TOKEN;
    const postRequest: ChatPostMessageArguments = {
      token,
      channel,
      text,
    };
    this.web.chat.postMessage(postRequest).catch(e => console.error(e));
  }

  public getAllUsers(): Promise<WebAPICallResult> {
    return this.web.users.list();
  }

  public uploadFile(channel: string, content: string, title?: string): void {
    console.log(title);
    // const muzzleToken: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    // const uploadRequest: FilesUploadArguments = {
    //   channels: channel,
    //   content,
    //   filetype: 'markdown',
    //   title,
    //   // eslint-disable-next-line @typescript-eslint/camelcase
    //   initial_comment: title,
    //   token: muzzleToken,
    // };

    this.sendMessage(channel, content);
    // this.web.files.upload(uploadRequest).catch(e => console.error(e));
  }
}
