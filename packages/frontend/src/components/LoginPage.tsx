import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/config';
import { Search, BarChart2, Lock } from 'lucide-react';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied. Please try again.',
  token_exchange_failed: 'Authentication failed. Please try again.',
  unauthorized_workspace: 'Only members of the dabros2016.slack.com workspace may access this app.',
  server_error: 'An unexpected error occurred. Please try again.',
};

interface LoginPageProps {
  authError?: string;
}

const FEATURES = [
  {
    icon: Lock,
    title: 'Slack Sign-In',
    description: 'Use your Slack identity to securely sign in and keep your session active with an HTTP-only cookie.',
  },
  {
    icon: BarChart2,
    title: 'Bathroom Leaderboard',
    description: 'Track bathroom breaks per day and compare totals on a least-to-most daily leaderboard.',
  },
  {
    icon: Search,
    title: 'Workspace Search',
    description: 'Keep the existing Slack search and team insights features alongside the new bathroom timer.',
  },
];

export function LoginPage({ authError }: LoginPageProps) {
  const loginUrl = `${API_BASE_URL}/auth/slack`;
  const errorMessage = authError
    ? (AUTH_ERROR_MESSAGES[authError] ?? 'Authentication failed. Please try again.')
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation */}
      <header className="border-b">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between max-w-6xl">
          <span className="font-bold text-lg tracking-tight">muzzle.lol</span>
          <Button variant="outline" size="sm" asChild>
            <a href={loginUrl}>Sign In</a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 max-w-3xl leading-tight">
          Your Slack bathroom timer,
          <br />
          leaderboard included.
        </h1>
        <p className="text-xl text-muted-foreground max-w-xl mb-10">
          Sign in with Slack, start or stop your personal timer, and see who spent the least time in the bathroom today.
        </p>
        {errorMessage && (
          <p className="text-destructive text-sm mb-4" role="alert">
            {errorMessage}
          </p>
        )}
        <a
          href={loginUrl}
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Sign in with Slack
        </a>
      </section>

      {/* Features */}
      <section className="border-t py-16 px-6 bg-muted/40">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
