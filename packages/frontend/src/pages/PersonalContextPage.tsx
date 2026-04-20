import { AlertCircle, BookHeart, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePersonalContext } from '@/hooks/usePersonalContext';
import type { PersonalContextEntry } from '@/app.model';
import type { PersonalContextPageProps } from '@/pages/PersonalContextPage.model';

function formatDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ContextList({
  heading,
  description,
  emptyMessage,
  entries,
}: {
  heading: string;
  description: string;
  emptyMessage: string;
  entries: PersonalContextEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry, index) => (
              <li key={entry.id} className="rounded-md border bg-card/50 px-3 py-2">
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold">{index + 1}. </span>
                  {entry.content}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Updated {formatDateLabel(entry.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function PersonalContextPage({ onLogout }: PersonalContextPageProps) {
  const { data, isLoading, error } = usePersonalContext(onLogout);

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Memory + Traits</h1>
        <p className="mt-2 text-muted-foreground">
          See what Moonbeam remembers about you and which core traits it currently uses for personalization.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookHeart className="h-5 w-5" aria-hidden="true" />
                Memories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Loading memories...</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                Traits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Loading traits...</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ContextList
            heading="Memories"
            description="Facts and context Moonbeam has extracted from your conversation history."
            emptyMessage="Moonbeam does not have any memories about you yet."
            entries={data?.memories ?? []}
          />
          <ContextList
            heading="Traits"
            description="Higher-level behavioral summaries inferred from your reinforced memories."
            emptyMessage="Moonbeam does not have any core traits about you yet."
            entries={data?.traits ?? []}
          />
        </div>
      )}
    </div>
  );
}
