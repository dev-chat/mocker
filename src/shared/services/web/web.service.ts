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
  ConversationsListResponse,
} from '@slack/web-api';
import { logger } from '../../logger/logger';

const MAX_RETRIES = 5;

export class WebService {
  private web: WebClient = new WebClient(process.env.MUZZLE_BOT_TOKEN);
  logger = logger.child({ module: 'WebService' });

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
      as_user: true,
    };

    this.web.chat
      .delete(deleteRequest)
      .then((r) => {
        if (r.error) {
          this.logger.error(r.error);
          this.logger.error(deleteRequest);
          this.logger.error(user);
        }
      })
      .catch((e) => {
        this.logger.error(e);
        if (e.data.error !== 'message_not_found') {
          this.logger.error(e);
          this.logger.error('delete request was : ');
          this.logger.error(deleteRequest);
          this.logger.error('Unable to delete message. Retrying in 5 seconds...');
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
      .then((result) => result)
      .catch((e) => {
        this.logger.error(e);
        this.logger.error(postRequest);
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
      .then((result) => result)
      .catch((e) => {
        this.logger.error(e);
        this.logger.error(e.data);
        this.logger.error(postRequest);
        throw e;
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
    this.web.chat.update(update).catch((e) => this.logger.error(e));
  }

  public getAllUsers(): Promise<WebAPICallResult> {
    return this.web.users.list();
  }

  public getAllChannels(): Promise<ConversationsListResponse> {
    return this.web.conversations.list();
  }

  public uploadFile(channel: string, content: string, title: string, userId: string): void {
    const muzzleToken: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const uploadRequest: FilesUploadArguments = {
      channels: channel,
      content,
      filetype: 'auto',
      title,
      initial_comment: title,
      token: muzzleToken,
    };

    this.web.files.upload(uploadRequest).catch((e: unknown) => {
      this.logger.error(e);
      const options: ChatPostEphemeralArguments = {
        channel,
        text:
          (e as Record<string, Record<string, string>>).data.error === 'not_in_channel'
            ? `Oops! I tried to post the stats you requested but it looks like I haven't been added to that channel yet. Can you please add me? Just type \`@muzzle\` in the channel!`
            : `Oops! I tried to post the stats you requested but it looks like something went wrong. Please try again later.`,
        user: userId,
      };
      this.web.chat.postEphemeral(options).catch((e) => this.logger.error(e));
    });
  }
}
