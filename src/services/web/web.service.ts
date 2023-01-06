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
  FilesGetUploadURLExternalArguments,
  FilesGetUploadURLExternalResponse,
  FilesCompleteUploadExternalArguments,
  FilesInfoArguments,
} from '@slack/web-api';
import path from 'path';
import fs from 'fs';
import Axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { URLSearchParams } from 'url';

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
        console.error(e.data);
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

  public async getUploadUrl(filePath: string, filename: string): Promise<FilesGetUploadURLExternalResponse> {
    const fileSizeInBytes = (await fs.promises.stat(filePath)).size;
    const fileUploadOptions: FilesGetUploadURLExternalArguments = {
      filename,
      length: fileSizeInBytes,
    };
    return this.web.files.getUploadURLExternal(fileUploadOptions).then(x => {
      if (x.upload_url) {
        return x;
      }
      throw new Error('Unable to generate an upload url');
    });
  }

  public async uploadFileToImgur(base64Image: string): Promise<string | undefined> {
    const formData = new URLSearchParams();
    formData.append('image', base64Image);
    return Axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
      },
    })
      .then(x => x.data.data.link)
      .catch(e => {
        throw e;
      });
  }

  // public getImageFromUrl(url: string): Promise<Record<string, string>> {
  //   return Axios.get(url, { responseType: 'stream' }).then(response => {
  //     return new Promise((resolve, reject) => {
  //       const uuid = uuidv4();
  //       const location = path.join(process.cwd(), '/images', `${uuid}.png`);
  //       const writeStream = fs.createWriteStream(location);
  //       response.data.pipe(writeStream);
  //       writeStream.on('close', () => {
  //         resolve({ filePath: location, fileName: `${uuid}.png` });
  //       });
  //       writeStream.on('error', e => {
  //         reject(e);
  //       });
  //     });
  //   });
  // }
}
