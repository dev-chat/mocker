import { useMemo, useState } from 'react';
import { AlertCircle, MessageSquareQuote, Scale, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useArgumentLeaderboard } from '@/hooks/useArgumentLeaderboard';
import type { ArgumentOutcomeEntry, ArgumentParticipant } from '@/app.model';
import type { ArgumentLeaderboardPageProps } from '@/pages/ArgumentLeaderboardPage.model';

function formatDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function WinnerBadge({ participant, isWinner }: { participant: ArgumentParticipant; isWinner: boolean }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{participant.name}</p>
        {isWinner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Winner
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{participant.viewpoint}</p>
    </div>
  );
}

export function ArgumentLeaderboardPage({ onLogout }: ArgumentLeaderboardPageProps) {
  const { data, isLoading, error } = useArgumentLeaderboard(onLogout);
  const [selectedArgumentId, setSelectedArgumentId] = useState<number | null>(null);

  const selectedArgument = useMemo<ArgumentOutcomeEntry | null>(() => {
    if (!data?.arguments.length) {
      return null;
    }

    if (selectedArgumentId === null) {
      return data.arguments[0];
    }

    return data.arguments.find((argument) => argument.id === selectedArgumentId) ?? data.arguments[0];
  }, [data, selectedArgumentId]);

  return (
    <div className="max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Argument Leaderboard</h1>
        <p className="mt-2 text-muted-foreground">
          See who wins the most debates, how many substance points they have earned, and review past verdicts.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <section aria-label="Argument standings">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" aria-hidden="true" />
              Top debaters
            </CardTitle>
            <CardDescription>Ranked by argument wins, with substance points as the tiebreaker.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
            ) : !data?.leaderboard.length ? (
              <p className="text-sm text-muted-foreground">No arguments have been judged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Rank</th>
                      <th className="py-2 pr-4 font-medium">User</th>
                      <th className="py-2 pr-4 font-medium">Wins</th>
                      <th className="py-2 font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((entry, index) => (
                      <tr key={entry.slackId} className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium">#{index + 1}</td>
                        <td className="py-3 pr-4">{entry.name}</td>
                        <td className="py-3 pr-4">{entry.wins}</td>
                        <td className="py-3">{entry.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <section aria-label="Past argument outcomes">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5" aria-hidden="true" />
                Previous arguments
              </CardTitle>
              <CardDescription>Pick a verdict to review the argument, sides, winner, and point value.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading argument history...</p>
              ) : !data?.arguments.length ? (
                <p className="text-sm text-muted-foreground">No argument outcomes are available yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.arguments.map((argument) => (
                    <button
                      key={argument.id}
                      type="button"
                      onClick={() => setSelectedArgumentId(argument.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selectedArgument?.id === argument.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/40 hover:bg-accent/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium">{argument.argument}</p>
                        <span className="text-xs text-muted-foreground">{formatDateLabel(argument.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Winner: {argument.winner.name}</span>
                        <span>•</span>
                        <span>{argument.pointValue}/5 points</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Selected argument detail">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" aria-hidden="true" />
                Detailed outcome
              </CardTitle>
              <CardDescription>Review how Moonbeam scored the selected debate.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedArgument ? (
                <p className="text-sm text-muted-foreground">Select an argument to inspect the full outcome.</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Argument</p>
                    <p className="mt-2 text-sm leading-relaxed">{selectedArgument.argument}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Participants</p>
                    <div className="mt-3 space-y-3">
                      {selectedArgument.participants.map((participant) => (
                        <WinnerBadge
                          key={participant.slackId}
                          participant={participant}
                          isWinner={participant.slackId === selectedArgument.winner.slackId}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Winner</p>
                        <p className="mt-1 font-semibold">{selectedArgument.winner.name}</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" disabled>
                        {selectedArgument.pointValue}/5 points
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Logged on {formatDateLabel(selectedArgument.createdAt)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
