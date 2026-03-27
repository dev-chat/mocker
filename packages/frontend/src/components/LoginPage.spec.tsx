import { render, screen } from '@testing-library/react';
import { LoginPage } from '@/components/LoginPage';

describe('LoginPage', () => {
  it('renders the sign-in button linking to the auth endpoint', () => {
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: /sign in with slack/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('/auth/slack'));
  });

  it('shows no error message when authError is not provided', () => {
    render(<LoginPage />);
    expect(screen.queryByText(/access was denied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authentication failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unexpected error/i)).not.toBeInTheDocument();
  });

  it('shows a workspace-specific error when authError is unauthorized_workspace', () => {
    render(<LoginPage authError="unauthorized_workspace" />);
    expect(screen.getByText(/only members of the dabros2016\.slack\.com workspace/i)).toBeInTheDocument();
  });

  it('shows a generic error for an unrecognised authError code', () => {
    render(<LoginPage authError="some_unknown_error" />);
    expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
  });

  it('shows an access-denied message for the access_denied error code', () => {
    render(<LoginPage authError="access_denied" />);
    expect(screen.getByText(/access was denied/i)).toBeInTheDocument();
  });

  it('shows a token-exchange message for the token_exchange_failed error code', () => {
    render(<LoginPage authError="token_exchange_failed" />);
    expect(screen.getByText(/authentication failed\. please try again\./i)).toBeInTheDocument();
  });

  it('shows a server-error message for the server_error error code', () => {
    render(<LoginPage authError="server_error" />);
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });
});
