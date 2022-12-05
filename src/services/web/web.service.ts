import {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebAPICallResult,
  WebClient,
  ChatPostEphemeralArguments,
  ChatUpdateArguments,
  KnownBlock,
  Block,
  FilesUploadV2Arguments,
} from '@slack/web-api';
import { ImageUpload } from './ImageUpload.interface';

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
  public deleteMessage(channel: string, ts: string, user: string, times = 0): void {
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

    this.web.chat
      .delete(deleteRequest)
      .then(r => {
        if (r.error) {
          console.error(r.error);
          console.error(deleteRequest);
          console.log(user);
        }
      })
      .catch(e => {
        console.error(e);
        if (e.data.error !== 'message_not_found') {
          console.error(e);
          console.error('delete request was : ');
          console.error(deleteRequest);
          console.error('Unable to delete message. Retrying in 5 seconds...');
          setTimeout(() => this.deleteMessage(channel, ts, user, times + 1), 5000);
        }
      });
  }

  public sendEphemeral(channel: string, text: string, user: string): Promise<WebAPICallResult> {
    const token: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const postRequest: ChatPostEphemeralArguments = {
      token,
      channel,
      text,
      user,
    };
    return this.web.chat
      .postEphemeral(postRequest)
      .then(result => result)
      .catch(e => {
        console.error(e);
        console.log(postRequest);
        return e;
      });
  }

  /**
   * Handles sending messages to the chat.
   */
  public sendMessage(channel: string, text: string, blocks?: Block[] | KnownBlock[]): Promise<WebAPICallResult> {
    const token: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const postRequest: ChatPostMessageArguments = {
      token,
      channel,
      text,
    };

    if (blocks) {
      postRequest.blocks = blocks;
    }

    return this.web.chat
      .postMessage(postRequest)
      .then(result => result)
      .catch(e => {
        console.error(e);
        console.log(postRequest);
        return e;
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
      filetype: 'auto',
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
      this.web.chat.postEphemeral(options).catch(e => console.error(e));
    });
  }

  public uploadImage(buffer: Buffer, channel: string, title: string, userId: string): Promise<string | void> {
    const muzzleToken: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const uploadRequest: FilesUploadV2Arguments = {
      file: buffer,
      title,
      name: title,
      filename: `${title}.png`,
      // eslint-disable-next-line @typescript-eslint/camelcase
      initial_comment: title,
      token: muzzleToken,
    };

    return this.web.files
      .uploadV2(uploadRequest)
      .then((x: WebAPICallResult) => {
        const response = x as ImageUpload;
        if (response.ok) {
          console.log(response?.files[0]?.file);
          return response?.files?.[0].file.url_private_download;
        }
        throw new Error('Failure on upload');
      })
      .catch((e: any) => {
        console.error(e);
        const options: ChatPostEphemeralArguments = {
          channel,
          text:
            e.data.error === 'not_in_channel'
              ? `Oops! I tried to post the image you requested but it looks like I haven't been added to that channel yet. Can you please add me? Just type \`@muzzle\` in the channel!`
              : `Oops! I tried to post the image you requested but it looks like something went wrong. Please try again later.`,
          user: userId,
        };
        this.web.chat.postEphemeral(options).catch(e => console.error(e));
      });
  }
}
