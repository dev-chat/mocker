import { Badge } from '@/components/ui/badge';
import { MENTION_REGEX } from '@/components/MessageText.const';
import type { MessageTextProps, Segment } from '@/components/MessageText.model';

export function parseMessageSegments(text: string, mentions: Record<string, string>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    const type = match[1];
    const id = match[2];
    const resolvedName = mentions[id];

    if (resolvedName) {
      segments.push({ kind: type === '@' ? 'user' : 'channel', id, name: resolvedName });
    } else {
      segments.push({ kind: 'text', value: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function MessageText({ text, mentions, onUserClick, onChannelClick }: MessageTextProps) {
  const segments = parseMessageSegments(text, mentions);

  return (
    <span className="break-words">
      {segments.map((segment, i) => {
        const key = `${i}-${segment.kind}-${segment.kind === 'text' ? segment.value : segment.id}`;
        if (segment.kind === 'text') {
          return <span key={key}>{segment.value}</span>;
        }
        if (segment.kind === 'user') {
          return (
            <Badge
              key={key}
              variant="secondary"
              className="cursor-pointer mx-0.5"
              onClick={() => onUserClick(segment.name)}
              title={`Filter by user: ${segment.name}`}
            >
              @{segment.name}
            </Badge>
          );
        }
        return (
          <Badge
            key={key}
            variant="outline"
            className="cursor-pointer mx-0.5"
            onClick={() => onChannelClick(segment.name)}
            title={`Filter by channel: ${segment.name}`}
          >
            #{segment.name}
          </Badge>
        );
      })}
    </span>
  );
}
