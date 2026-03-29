import { BarChart2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function HomePage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground mt-2">Your Slack workspace at a glance.</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BarChart2 className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Dashboard coming soon</CardTitle>
              <CardDescription>
                We&apos;re building data visualizations and insights for your workspace here.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In the meantime, use <strong>Message Search</strong> from the sidebar to explore your Slack history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
