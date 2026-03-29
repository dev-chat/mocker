import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '@/App';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const filtersResponse = {
  users: ['alice', 'bob'],
  channels: ['general', 'random'],
};

const setupAuthenticatedFetch = () => {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/search/filters')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => filtersResponse,
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ messages: [], mentions: {}, total: 0 }),
    });
  });
};

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
  window.history.replaceState({}, '', '/');
});

describe('App – unauthenticated state', () => {
  it('renders the LoginPage when no token is present', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /sign in with slack/i })).toBeInTheDocument();
  });

  it('reads an auth_error from the URL and passes it to LoginPage', () => {
    window.history.replaceState({}, '', '/?auth_error=unauthorized_workspace');
    render(<App />);
    expect(screen.getByText(/only members of the dabros2016\.slack\.com workspace/i)).toBeInTheDocument();
  });
});

describe('App – token in URL hash', () => {
  it('stores the token from the hash, clears the hash, and shows the search UI', () => {
    setupAuthenticatedFetch();
    window.history.replaceState({}, '', '/#token=test-token-123');
    render(<App />);
    expect(screen.getByRole('heading', { name: /message search/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    expect(localStorage.getItem('muzzle.lol-auth-token')).toBe('test-token-123');
    expect(window.location.hash).toBe('');
  });
});

describe('App – authenticated state', () => {
  beforeEach(() => {
    localStorage.setItem('muzzle.lol-auth-token', 'stored-token');
    setupAuthenticatedFetch();
  });

  it('shows the search UI when a token is already stored', () => {
    render(<App />);
    expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message content/i)).toBeInTheDocument();
  });

  it('prepopulates user and channel filter suggestions', async () => {
    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('#user-filter-options option[value="alice"]')).not.toBeNull();
      expect(document.querySelector('#channel-filter-options option[value="general"]')).not.toBeNull();
    });
  });

  it('clears the token and returns to LoginPage on Sign out click', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(localStorage.getItem('muzzle.lol-auth-token')).toBeNull();
    expect(screen.getByRole('link', { name: /sign in with slack/i })).toBeInTheDocument();
  });

  it('shows active filter badges when inputs have values', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText(/channel/i), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText(/message content/i), { target: { value: 'hello' } });
    expect(screen.getByText(/user: alice/i)).toBeInTheDocument();
    expect(screen.getByText(/channel: general/i)).toBeInTheDocument();
    expect(screen.getByText(/content: hello/i)).toBeInTheDocument();
  });

  it('triggers search after typing in an input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ messages: [], mentions: {}, total: 0 }),
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    await waitFor(() => expect(screen.getByText(/no messages found/i)).toBeInTheDocument(), { timeout: 2000 });
  });

  it('does not trigger search when no input values change', async () => {
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText(/user name/i), { key: 'a' });
    const messageSearchCalls = mockFetch.mock.calls.filter((call) => String(call[0]).includes('/search/messages'));
    expect(messageSearchCalls).toHaveLength(0);
  });

  it('does not send a search request when all filters are empty', async () => {
    setupAuthenticatedFetch();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    const messageSearchCalls = mockFetch.mock.calls.filter((call) => String(call[0]).includes('/search/messages'));
    expect(messageSearchCalls).toHaveLength(0);
    expect(screen.queryByText(/no messages found/i)).not.toBeInTheDocument();
  });

  it('calls the search API and displays a single result', async () => {
    const messages = [
      {
        id: 1,
        message: 'Hello world',
        channel: 'C123',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 1 }) });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('Hello world')).toBeInTheDocument());
    expect(screen.getByText('#general')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/found 1 message overall/i)).toBeInTheDocument();
  });

  it('displays plural "messages" for more than one result', async () => {
    const messages = [
      {
        id: 1,
        message: 'A',
        channel: 'c',
        teamId: 'T',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'u',
        slackId: 'U1',
      },
      {
        id: 2,
        message: 'B',
        channel: 'c',
        teamId: 'T',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'v',
        slackId: 'U2',
      },
    ];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 2 }) });
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => expect(screen.getByText(/found 2 messages overall/i)).toBeInTheDocument());
  });

  it('filters result rows in the table', async () => {
    const messages = [
      {
        id: 1,
        message: 'alpha keyword',
        channel: 'C111',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-02T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
      {
        id: 2,
        message: 'beta text',
        channel: 'C222',
        channelName: 'random',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'bob',
        slackId: 'U2',
      },
    ];

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 2 }) });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/found 2 messages overall/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/filter result rows/i), { target: { value: 'alpha' } });

    await waitFor(() => {
      expect(screen.getByText('alpha keyword')).toBeInTheDocument();
      expect(screen.queryByText('beta text')).not.toBeInTheDocument();
      expect(screen.getByText(/found 2 messages overall \(1 shown\)/i)).toBeInTheDocument();
    });
  });

  it('sorts result rows by user when toggling the user header', async () => {
    const messages = [
      {
        id: 1,
        message: 'from bob',
        channel: 'C111',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-02T00:00:00.000Z',
        name: 'bob',
        slackId: 'U1',
      },
      {
        id: 2,
        message: 'from alice',
        channel: 'C111',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U2',
      },
    ];

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 2 }) });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/found 2 messages overall/i)).toBeInTheDocument());

    const table = screen.getByRole('table');
    const userOrder = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent?.trim());

    expect(userOrder()).toEqual(['bob', 'alice']);

    fireEvent.click(screen.getByRole('button', { name: /^user$/i }));
    await waitFor(() => expect(userOrder()).toEqual(['alice', 'bob']));

    fireEvent.click(screen.getByRole('button', { name: /^user$/i }));
    await waitFor(() => expect(userOrder()).toEqual(['bob', 'alice']));
  });

  it('shows "no messages found" when search returns an empty array', async () => {
    setupAuthenticatedFetch();
    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() =>
      expect(screen.getByText(/no messages found matching your search criteria/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when the search API returns a non-ok response', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }

      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/search failed: internal server error/i)).toBeInTheDocument());
  });

  it('clicking a user mention badge sets the userName filter', async () => {
    const messages = [
      {
        id: 1,
        message: 'Hey <@U99>',
        channel: 'C123',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ messages, mentions: { U99: 'carol' }, total: 1 }),
      });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('@carol')).toBeInTheDocument());

    fireEvent.click(screen.getByText('@carol'));

    expect(screen.getByLabelText(/user name/i)).toHaveValue('carol');
  });

  it('clicking a channel mention badge sets the channel filter', async () => {
    const messages = [
      {
        id: 1,
        message: 'See <#C99>',
        channel: 'C123',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ messages, mentions: { C99: 'announcements' }, total: 1 }),
      });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('#announcements')).toBeInTheDocument());

    fireEvent.click(screen.getByText('#announcements'));

    expect(screen.getByLabelText(/channel/i)).toHaveValue('announcements');
  });

  it('logs out when the API returns 401', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: false, status: 401 });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByRole('link', { name: /sign in with slack/i })).toBeInTheDocument());
    expect(localStorage.getItem('muzzle.lol-auth-token')).toBeNull();
  });

  it('shows pagination controls when total exceeds page size', async () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      message: `msg ${i + 1}`,
      channel: 'C111',
      channelName: 'general',
      teamId: 'T1',
      createdAt: '2024-01-01T00:00:00.000Z',
      name: 'alice',
      slackId: 'U1',
    }));

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 50 }) });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/found 50 messages overall/i)).toBeInTheDocument());
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('navigates to the next page when Next is clicked', async () => {
    const page1Messages = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      message: `page1 msg ${i + 1}`,
      channel: 'C111',
      channelName: 'general',
      teamId: 'T1',
      createdAt: '2024-01-01T00:00:00.000Z',
      name: 'alice',
      slackId: 'U1',
    }));
    const page2Messages = [
      {
        id: 26,
        message: 'page2 msg 1',
        channel: 'C111',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];

    let callCount = 0;
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ messages: page1Messages, mentions: {}, total: 26 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ messages: page2Messages, mentions: {}, total: 26 }),
      });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));

    await waitFor(() => {
      expect(screen.getByText('page2 msg 1')).toBeInTheDocument();
      expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('does not show pagination controls when results fit on one page', async () => {
    const messages = [
      {
        id: 1,
        message: 'only message',
        channel: 'C111',
        channelName: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/filters')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => filtersResponse });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages, mentions: {}, total: 1 }) });
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/found 1 message overall/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /previous page/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
  });

  it('passes limit and offset query params to the search API', async () => {
    setupAuthenticatedFetch();
    render(<App />);
    fireEvent.change(screen.getByLabelText(/user name/i), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      const searchCalls = mockFetch.mock.calls.filter((call) => String(call[0]).includes('/search/messages'));
      expect(searchCalls.length).toBeGreaterThan(0);
      const url = String(searchCalls[0][0]);
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=0');
    });
  });
});
