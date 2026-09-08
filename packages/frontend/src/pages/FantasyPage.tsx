import { useState } from 'react';
import { AlertCircle, ArrowRight, ExternalLink, Sparkles, Trophy, Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFantasy } from '@/hooks/useFantasy';
import type { FantasyPlayer } from '@/app.model';
import type { FantasyPageProps } from '@/pages/FantasyPage.model';

function PlayerList({ players }: { players: FantasyPlayer[] }) {
  if (!players.length) return <span className="text-muted-foreground">No players</span>;
  return (
    <span>
      {players.map((player) => (
        <span key={player.id} className="mr-2 inline-flex items-center gap-1">
          {player.name}
          {player.position && <Badge variant="outline">{player.position}</Badge>}
        </span>
      ))}
    </span>
  );
}

export function FantasyPage({ onLogout }: FantasyPageProps) {
  const { landing, overview, isLoading, error, selectedLeagueId, selectLeague, linkSleeperUser } = useFantasy(onLogout);
  const [sleeperUser, setSleeperUser] = useState('');

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fantasy leagues</h1>
        <p className="text-muted-foreground mt-2">
          Review trades, get AI recommendations, and know which games matter to your roster.
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

      {!landing?.sleeperUser ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Connect Sleeper</CardTitle>
            <CardDescription>Enter your public Sleeper username or user ID to load your leagues.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void linkSleeperUser(sleeperUser);
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="sleeper-user">Sleeper username or user ID</Label>
                <Input
                  id="sleeper-user"
                  value={sleeperUser}
                  onChange={(event) => setSleeperUser(event.target.value)}
                  placeholder="Sleeper username"
                  required
                />
              </div>
              <Button className="self-end" type="submit" disabled={isLoading || !sleeperUser.trim()}>
                {isLoading ? 'Connecting…' : 'Connect'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Connected as</p>
              <p className="font-semibold">{landing.sleeperUser.display_name}</p>
            </div>
            <div className="min-w-64 space-y-2">
              <Label htmlFor="league-select">League</Label>
              <select
                id="league-select"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedLeagueId ?? ''}
                onChange={(event) => selectLeague(event.target.value)}
              >
                {landing.leagues.map((league) => (
                  <option key={league.league_id} value={league.league_id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {!landing.leagues.length && !isLoading && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No NFL leagues were found for the {landing.season} season.
              </CardContent>
            </Card>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Loading Sleeper data and AI insights…</p>}

          {overview && !isLoading && (
            <>
              {overview.aiStatus === 'unavailable' && (
                <Card className="border-amber-500/50">
                  <CardContent className="pt-6 text-sm">
                    League data is current, but AI trade analysis is temporarily unavailable.
                  </CardContent>
                </Card>
              )}
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">{overview.league.name}</h2>
                  <Button variant="outline" size="sm" asChild>
                    <a href={overview.sleeperUrl} target="_blank" rel="noreferrer">
                      Open in Sleeper <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{overview.league.season}</Badge>
                  <Badge variant="outline">{overview.league.status.replace('_', ' ')}</Badge>
                  <Badge variant="outline">{overview.league.total_rosters} teams</Badge>
                  <Badge variant="outline">{overview.roster.players.length} rostered players</Badge>
                </div>
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> Pending trades
                </h2>
                {!overview.pendingTrades.length ? (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      There are no pending trades this week.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {overview.pendingTrades.map((trade) => (
                      <Card key={trade.transactionId}>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle>Trade proposal</CardTitle>
                            <Badge variant={trade.recommendation === 'decline' ? 'destructive' : 'secondary'}>
                              AI: {trade.recommendation}
                            </Badge>
                          </div>
                          <CardDescription>{trade.insight}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          {trade.sides.map((side) => (
                            <div key={side.rosterId} className="rounded-lg border p-4 text-sm">
                              <p className="mb-2 font-semibold">{side.ownerName} receives</p>
                              <PlayerList players={side.players} />
                              {side.draftPicks.map((pick) => (
                                <Badge className="mr-2 mt-2" variant="outline" key={pick}>
                                  {pick}
                                </Badge>
                              ))}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Tv className="h-5 w-5 text-primary" aria-hidden="true" /> Games to watch
                </h2>
                {!overview.gamesToWatch.length ? (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      No scheduled games currently include players from your roster.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {overview.gamesToWatch.map((game) => (
                      <Card key={game.id}>
                        <CardHeader>
                          <CardTitle>
                            {game.awayTeam} at {game.homeTeam}
                          </CardTitle>
                          <CardDescription>
                            {new Date(game.startsAt).toLocaleString()} · {game.broadcast ?? game.status}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <PlayerList players={game.rosterPlayers} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Trade ideas
                </h2>
                {!overview.tradeSuggestions.length ? (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      No strong trade opportunities were identified right now.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {overview.tradeSuggestions.map((suggestion, index) => (
                      <Card key={`${suggestion.targetRosterId}-${index}`}>
                        <CardHeader>
                          <CardTitle>{suggestion.targetOwnerName}</CardTitle>
                          <CardDescription>{suggestion.rationale}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div>
                            <p className="font-medium">You send</p>
                            <PlayerList players={suggestion.give} />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <p className="font-medium">You receive</p>
                            <PlayerList players={suggestion.receive} />
                          </div>
                          <Button className="w-full" asChild>
                            <a href={suggestion.sleeperUrl} target="_blank" rel="noreferrer">
                              Propose in Sleeper <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
