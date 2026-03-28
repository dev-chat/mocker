import type { Message } from '../../db/models/Message';

export interface MessageWithName extends Message {
  name: string;
  slackId: string;
  channelName?: string;
}
