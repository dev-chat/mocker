export interface IChannelResponse {
  response_type: string;
  text: string;
  attachments: IAttachment[];
}

export interface ISlashCommandRequest {
  text: string;
  user_id: string;
  response_url: string;
}

export interface IEventRequest {
  challenge: string;
  token: string;
  team_id: string;
  api_app_id: string;
  event: IEvent;
  type: string;
  event_id: string;
  event_time: number;
  authed_users: string[];
}

export interface IEvent {
  client_msg_id: string;
  type: string;
  subtype: string;
  text: string;
  user: string;
  username: string;
  ts: string;
  channel: string;
  event_ts: string;
  channel_type: string;
  authed_users: string[];
}

export interface IAttachment {
  text: string;
}
