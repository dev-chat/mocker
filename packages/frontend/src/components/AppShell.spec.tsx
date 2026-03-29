import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ users: [], channels: [] }),
  });
});

describe('AppShell', () => {
  it('renders the Home page by default', () => {
    render(<AppShell onLogout={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /home/i })).toBeInTheDocument();
  });

  it('switches to the Home page when the Home nav button is clicked', () => {
    render(<AppShell onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^home$/i }));
    expect(screen.getByRole('heading', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /message search/i })).not.toBeInTheDocument();
  });

  it('switches back to Message Search when the Message Search nav button is clicked', () => {
    render(<AppShell onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^home$/i }));
    fireEvent.click(screen.getByRole('button', { name: /message search/i }));
    expect(screen.getByRole('heading', { name: /message search/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^home$/i })).not.toBeInTheDocument();
  });

  it('calls onLogout when the Sign out button is clicked', () => {
    const onLogout = vi.fn();
    render(<AppShell onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
