import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebAPICallResult,
  WebClient,
  ChatPostEphemeralArguments,
  ChatUpdateArguments,
} from '@slack/web-api';

const MAX_RETRIES = 5;

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
  public deleteMessage(channel: string, ts: string, times = 0): void {
    if (times > MAX_RETRIES) {
      return;
    }
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
        console.error('delete request was : ');
        console.error(deleteRequest);
        console.error('Unable to delete message. Retrying in 5 seconds...');
        setTimeout(() => this.deleteMessage(channel, ts, times + 1), 5000);
      }
    });
  }

  /**
   * Handles sending messages to the chat.
   */
  public sendMessage(channel: string, text: string): Promise<WebAPICallResult> {
    const token: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const postRequest: ChatPostMessageArguments = {
      token,
      channel,
      text,
    };
    return this.web.chat
      .postMessage(postRequest)
      .then(result => result)
      .catch(e => {
        console.error(e);
        throw new Error(e);
      });
  }

  public sendBlockMessage(channel: string, text: string) {
    const token = process.env.MUZZLE_BOT_USER_TOKEN;
    const timestamp = new Date().getUTCMilliseconds();
    const postRequest: ChatPostMessageArguments = {
      token,
      channel,
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text,
            emoji: true,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `As of <!date^${timestamp}^{date_num} {time_secs}|As of a date and time that cannot be determined>`,
            },
          ],
        },
      ],
    };
    return this.web.chat
      .postMessage(postRequest)
      .then(result => result)
      .catch(e => {
        console.error(e);
        throw new Error(e);
      });
  }

  public editMessage(channel: string, text: string, ts: string): void {
    const token = process.env.MUZZLE_BOT_USER_TOKEN;
    const update: ChatUpdateArguments = {
      channel,
      text,
      ts,
      token,
    };
    this.web.chat.update(update).catch(e => console.error(e));
  }

  public getAllUsers(): Promise<WebAPICallResult> {
    return this.web.users.list();
  }

  public getAllChannels(): Promise<any> {
    return this.web.conversations.list().catch(e => console.log(e));
  }

  public uploadFile(channel: string, content: string, title: string, userId: string): void {
    const muzzleToken: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const uploadRequest: FilesUploadArguments = {
      channels: channel,
      content,
      filetype: 'markdown',
      title,
      // eslint-disable-next-line @typescript-eslint/camelcase
      initial_comment: title,
      token: muzzleToken,
    };

    this.web.files.upload(uploadRequest).catch((e: any) => {
      console.error(e);
      const options: ChatPostEphemeralArguments = {
        channel,
        text:
          e.data.error === 'not_in_channel'
            ? `Oops! I tried to post the stats you requested but it looks like I haven't been added to that channel yet. Can you please add me? Just type \`@muzzle\` in the channel!`
            : `Oops! I tried to post the stats you requested but it looks like something went wrong. Please try again later.`,
        user: userId,
      };
      this.web.chat.postEphemeral(options);
    });
  }
}
