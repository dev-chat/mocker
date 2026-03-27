import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied. Please try again.',
  token_exchange_failed: 'Authentication failed. Please try again.',
  unauthorized_workspace: 'Only members of the dabros2016.slack.com workspace may access this app.',
  server_error: 'An unexpected error occurred. Please try again.',
};

interface LoginPageProps {
  authError?: string;
}

export function LoginPage({ authError }: LoginPageProps) {
  const loginUrl = `${API_BASE_URL}/auth/slack`;
  const errorMessage = authError
    ? (AUTH_ERROR_MESSAGES[authError] ?? 'Authentication failed. Please try again.')
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Message Search</CardTitle>
          <CardDescription>Sign in with your dabros2016.slack.com account to search messages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
          <Button asChild className="w-full">
            <a href={loginUrl}>Sign in with Slack</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
