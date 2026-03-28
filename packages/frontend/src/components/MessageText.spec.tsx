import { render, screen, fireEvent } from '@testing-library/react';
import { MessageText, parseMessageSegments } from '@/components/MessageText';

describe('parseMessageSegments', () => {
  it('returns a single text segment for plain text with no mentions', () => {
    expect(parseMessageSegments('hello world', {})).toEqual([{ kind: 'text', value: 'hello world' }]);
  });

  it('resolves a user mention to a user segment when the id is in the mentions map', () => {
    const result = parseMessageSegments('Hey <@U123>', { U123: 'alice' });
    expect(result).toEqual([
      { kind: 'text', value: 'Hey ' },
      { kind: 'user', id: 'U123', name: 'alice' },
    ]);
  });

  it('resolves a channel mention to a channel segment when the id is in the mentions map', () => {
    const result = parseMessageSegments('Posted in <#C456>', { C456: 'general' });
    expect(result).toEqual([
      { kind: 'text', value: 'Posted in ' },
      { kind: 'channel', id: 'C456', name: 'general' },
    ]);
  });

  it('keeps unresolved mentions as raw text when the id is not in the mentions map', () => {
    const result = parseMessageSegments('Hi <@UUNKNOWN>', {});
    expect(result).toEqual([
      { kind: 'text', value: 'Hi ' },
      { kind: 'text', value: '<@UUNKNOWN>' },
    ]);
  });

  it('handles the |displayname variant in mention tokens', () => {
    const result = parseMessageSegments('<@U789|dave>', { U789: 'dave' });
    expect(result).toEqual([{ kind: 'user', id: 'U789', name: 'dave' }]);
  });

  it('handles multiple mixed mentions in one message', () => {
    const result = parseMessageSegments('Hey <@U1> see <#C2> for details', { U1: 'bob', C2: 'random' });
    expect(result).toEqual([
      { kind: 'text', value: 'Hey ' },
      { kind: 'user', id: 'U1', name: 'bob' },
      { kind: 'text', value: ' see ' },
      { kind: 'channel', id: 'C2', name: 'random' },
      { kind: 'text', value: ' for details' },
    ]);
  });

  it('returns empty array for empty text', () => {
    expect(parseMessageSegments('', {})).toEqual([]);
  });
});

describe('MessageText component', () => {
  const onUserClick = vi.fn();
  const onChannelClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text with no badges', () => {
    render(<MessageText text="hello world" mentions={{}} onUserClick={onUserClick} onChannelClick={onChannelClick} />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders a user mention as a badge with @ prefix', () => {
    render(
      <MessageText
        text="Hey <@U123>"
        mentions={{ U123: 'alice' }}
        onUserClick={onUserClick}
        onChannelClick={onChannelClick}
      />,
    );
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('renders a channel mention as a badge with # prefix', () => {
    render(
      <MessageText
        text="See <#C456>"
        mentions={{ C456: 'general' }}
        onUserClick={onUserClick}
        onChannelClick={onChannelClick}
      />,
    );
    expect(screen.getByText('#general')).toBeInTheDocument();
  });

  it('calls onUserClick with the resolved name when a user badge is clicked', () => {
    render(
      <MessageText
        text="Hey <@U123>"
        mentions={{ U123: 'alice' }}
        onUserClick={onUserClick}
        onChannelClick={onChannelClick}
      />,
    );
    fireEvent.click(screen.getByText('@alice'));
    expect(onUserClick).toHaveBeenCalledWith('alice');
    expect(onChannelClick).not.toHaveBeenCalled();
  });

  it('calls onChannelClick with the resolved name when a channel badge is clicked', () => {
    render(
      <MessageText
        text="See <#C456>"
        mentions={{ C456: 'general' }}
        onUserClick={onUserClick}
        onChannelClick={onChannelClick}
      />,
    );
    fireEvent.click(screen.getByText('#general'));
    expect(onChannelClick).toHaveBeenCalledWith('general');
    expect(onUserClick).not.toHaveBeenCalled();
  });

  it('renders an unresolved mention as raw text', () => {
    render(
      <MessageText text="Hi <@UUNKNOWN>" mentions={{}} onUserClick={onUserClick} onChannelClick={onChannelClick} />,
    );
    expect(screen.getByText('<@UUNKNOWN>')).toBeInTheDocument();
  });

  it('renders mixed text and mention segments correctly', () => {
    const { container } = render(
      <MessageText
        text="Hey <@U1> see <#C2> for details"
        mentions={{ U1: 'bob', C2: 'random' }}
        onUserClick={onUserClick}
        onChannelClick={onChannelClick}
      />,
    );
    expect(container.textContent).toMatch(/Hey/);
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(container.textContent).toMatch(/see/);
    expect(screen.getByText('#random')).toBeInTheDocument();
    expect(container.textContent).toMatch(/for details/);
  });
});
