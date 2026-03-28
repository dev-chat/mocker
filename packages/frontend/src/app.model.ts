export interface Message {
  id: number;
  message: string;
  channel: string;
  channelName?: string;
  teamId: string;
  createdAt: string;
  name: string;
  slackId: string;
}
