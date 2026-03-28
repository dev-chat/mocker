export interface MessageTextProps {
  text: string;
  mentions: Record<string, string>;
  onUserClick: (name: string) => void;
  onChannelClick: (name: string) => void;
}

export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'user'; id: string; name: string }
  | { kind: 'channel'; id: string; name: string };
