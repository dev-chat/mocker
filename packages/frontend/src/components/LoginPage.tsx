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
    icon: Search,
    title: 'Message Search',
    description: 'Search every message your team has ever sent — filter by user, channel, or content in seconds.',
  },
  {
    icon: BarChart2,
    title: 'Team Insights',
    description: 'Coming soon: visual analytics that reveal how your workspace communicates over time.',
  },
  {
    icon: Lock,
    title: 'Secure by Default',
    description: 'OAuth-powered sign-in via Slack keeps your data private and under your control.',
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
          Your Slack workspace,
          <br />
          searchable and insightful.
        </h1>
        <p className="text-xl text-muted-foreground max-w-xl mb-10">
          Search through your team&apos;s entire message history and unlock insights about how your workspace
          communicates.
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
