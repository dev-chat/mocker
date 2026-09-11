import type {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebAPICallResult,
  ChatPostEphemeralArguments,
  ChatUpdateArguments,
  KnownBlock,
  Block,
  ConversationsListResponse,
  UsersListResponse,
  UsersSetPhotoArguments,
} from '@slack/web-api';
import { WebClient } from '@slack/web-api';
import { logError } from '../../logger/error-logging';
import { logger } from '../../logger/logger';

const MAX_RETRIES = 5;

const getSlackErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const data = Reflect.get(error, 'data');
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const code = Reflect.get(data, 'error');
  return typeof code === 'string' ? code : undefined;
};

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
    // Deleting another member's message is only permitted for a workspace admin/owner user
    // token, so this call must stay on the user token rather than the bot token.
    const muzzleToken: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const deleteRequest: ChatDeleteArguments = {
      channel,
      ts,
    };

    this.web.chat
      .delete({
        ...deleteRequest,
        token: muzzleToken,
      })
      .then((r) => {
        if (r.error) {
          logError(this.logger, 'Slack deleteMessage returned an API error', new Error(r.error), {
            channel,
            ts,
            user,
            deleteRequest,
          });
        }
      })
      .catch((e) => {
        const errorCode = getSlackErrorCode(e);
        if (errorCode !== 'message_not_found') {
          logError(this.logger, 'Failed to delete Slack message; scheduling retry', e, {
            channel,
            ts,
            user,
            times,
            deleteRequest,
            errorCode,
          });
          setTimeout(() => this.deleteMessage(channel, ts, user, times + 1), 5000);
        }
      });
  }

  public sendEphemeral(channel: string, text: string, user: string): Promise<WebAPICallResult> {
    const postRequest: ChatPostEphemeralArguments = {
      channel,
      text,
      user,
    };
    return this.web.chat
      .postEphemeral(postRequest)
      .then((result) => result)
      .catch((e) => {
        logError(this.logger, 'Failed to send ephemeral Slack message', e, {
          channel,
          user,
          text,
          postRequest,
        });
        return e;
      });
  }

  /**
   * Handles sending messages to the chat.
   */
  public sendMessage(channel: string, text: string, blocks?: Block[] | KnownBlock[]): Promise<WebAPICallResult> {
    const postRequest: ChatPostMessageArguments = {
      channel,
      text,
      blocks,
      unfurl_links: false,
    };

    return this.web.chat
      .postMessage(postRequest)
      .then((result) => result)
      .catch((e) => {
        logError(this.logger, 'Failed to send Slack message', e, {
          channel,
          text,
          hasBlocks: !!blocks?.length,
          postRequest,
          errorCode: getSlackErrorCode(e),
        });
        throw e;
      });
  }

  public setProfilePhoto(image: Buffer): Promise<WebAPICallResult> {
    // users.setPhoto acts on the authenticated user's own profile, so it requires the user token.
    const token: string | undefined = process.env.MUZZLE_BOT_USER_TOKEN;
    const photoRequest: UsersSetPhotoArguments = {
      token,
      image,
    };

    return this.web.users
      .setPhoto(photoRequest)
      .then((result) => {
        if (result.ok === false) {
          throw new Error(result.error || 'unknown_slack_error');
        }

        return result;
      })
      .catch((e) => {
        logError(this.logger, 'Failed to set Slack profile photo', e, {
          errorCode: getSlackErrorCode(e),
        });
        throw e;
      });
  }

  public editMessage(channel: string, text: string, ts: string): void {
    const update: ChatUpdateArguments = {
      channel,
      text,
      ts,
    };
    this.web.chat.update(update).catch((e) =>
      logError(this.logger, 'Failed to edit Slack message', e, {
        channel,
        ts,
        text,
      }),
    );
  }

  public getAllUsers(): Promise<UsersListResponse> {
    return this.web.users.list({});
  }

  public getAllChannels(): Promise<ConversationsListResponse> {
    return this.web.conversations.list({
      exclude_archived: true,
      types: 'public_channel,private_channel',
    });
  }

  public uploadFile(channel: string, content: string, title: string, userId: string): void {
    const uploadRequest: FilesUploadArguments = {
      channels: channel,
      content,
      filetype: 'auto',
      title,
      initial_comment: title,
    };

    this.web.files.upload(uploadRequest).catch((e: unknown) => {
      const slackErrorCode = getSlackErrorCode(e);
      logError(this.logger, 'Failed to upload Slack file', e, {
        channel,
        title,
        userId,
        errorCode: slackErrorCode,
      });
      const options: ChatPostEphemeralArguments = {
        channel,
        text:
          slackErrorCode === 'not_in_channel'
            ? `Oops! I tried to post the stats you requested but it looks like I haven't been added to that channel yet. Can you please add me? Just type \`@muzzle\` in the channel!`
            : `Oops! I tried to post the stats you requested but it looks like something went wrong. Please try again later.`,
        user: userId,
      };
      this.web.chat.postEphemeral(options).catch((e) =>
        logError(this.logger, 'Failed to send fallback ephemeral after upload failure', e, {
          channel,
          userId,
          title,
        }),
      );
    });
  }
}
