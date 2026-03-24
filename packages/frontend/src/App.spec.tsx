import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '@/App';

const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    window.history.replaceState({}, '', '/#token=test-token-123');
    render(<App />);
    expect(screen.getByText(/message search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    expect(localStorage.getItem('muzzle.lol-auth-token')).toBe('test-token-123');
    expect(window.location.hash).toBe('');
  });
});

describe('App – authenticated state', () => {
  beforeEach(() => {
    localStorage.setItem('muzzle.lol-auth-token', 'stored-token');
  });

  it('shows the search UI when a token is already stored', () => {
    render(<App />);
    expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message content/i)).toBeInTheDocument();
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

  it('triggers search on Enter keydown in an input', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText(/user name/i), { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/no messages found/i)).toBeInTheDocument());
  });

  it('does not trigger search on a non-Enter keydown', async () => {
    render(<App />);
    fireEvent.keyDown(screen.getByLabelText(/user name/i), { key: 'a' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls the search API and displays a single result', async () => {
    const messages = [
      {
        id: 1,
        message: 'Hello world',
        channel: 'general',
        teamId: 'T1',
        createdAt: '2024-01-01T00:00:00.000Z',
        name: 'alice',
        slackId: 'U1',
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => messages,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('Hello world')).toBeInTheDocument());
    expect(screen.getByText('#general')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/found 1 message$/i)).toBeInTheDocument();
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
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => messages });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => expect(screen.getByText(/found 2 messages/i)).toBeInTheDocument());
  });

  it('shows "no messages found" when search returns an empty array', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() =>
      expect(screen.getByText(/no messages found matching your search criteria/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when the search API returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/search failed: internal server error/i)).toBeInTheDocument());
  });

  it('logs out when the API returns 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByRole('link', { name: /sign in with slack/i })).toBeInTheDocument());
    expect(localStorage.getItem('muzzle.lol-auth-token')).toBeNull();
  });
});
