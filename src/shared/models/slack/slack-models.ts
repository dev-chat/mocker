export interface ChannelResponse {
  response_type: string;
  text: string;
  attachments?: Attachment[];
}

export interface SlashCommandRequest {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

export interface EventRequest {
  challenge: string;
  token: string;
  team_id: string;
  api_app_id: string;
  event: Event;
  type: string;
  event_id: string;
  event_time: number;
  authed_users: string[];
}

export interface EventItem {
  type: string;
  channel: string;
}

export interface Event {
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
  attachments: Event[];
  pretext: string;
  callback_id: string;
  item_user: string;
  reaction: string;
  item: EventItem; // Needs work, not optional either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: Record<any, any>[]; // same same
  bot_id: string;
  bot_profile: {
    name: string;
  };
}

export interface Attachment {
  text: string;
  pretext?: string;
  mrkdown_in?: string[];
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  updated: number;
  profile: {
    bot_id: string;
    display_name: string;
    real_name: string;
  };
}
