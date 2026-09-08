import {
  Activity,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Trophy,
  Tv,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const {
    landing,
    overview,
    isLoading,
    error,
    selectedLeagueId,
    selectLeague,
    refreshingSuggestions,
    refreshSuggestions,
  } = useFantasy(onLogout);

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
            <CardTitle>No Sleeper account linked</CardTitle>
            <CardDescription>
              Account linking is unavailable until Sleeper account ownership can be verified.
            </CardDescription>
          </CardHeader>
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

              {overview.teamHealth && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Activity
                          className={
                            overview.teamHealth.rating === 'good'
                              ? 'h-7 w-7 text-green-500'
                              : overview.teamHealth.rating === 'ok'
                                ? 'h-7 w-7 text-yellow-500'
                                : 'h-7 w-7 text-red-500'
                          }
                          aria-hidden="true"
                        />
                        <div>
                          <CardTitle>Team health</CardTitle>
                          <CardDescription className="mt-1">{overview.teamHealth.summary}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">{overview.teamHealth.percentage}%</p>
                        <p className="text-sm font-medium capitalize text-muted-foreground">
                          {overview.teamHealth.rating}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

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
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Trade ideas
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={refreshingSuggestions !== null}
                    onClick={() => void refreshSuggestions('trades')}
                  >
                    <RefreshCw
                      className={refreshingSuggestions === 'trades' ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    {refreshingSuggestions === 'trades' ? 'Refreshing…' : 'Refresh ideas'}
                  </Button>
                </div>
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

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" /> Waiver wire proposals
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Waivers process Wednesday and Sunday.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={refreshingSuggestions !== null}
                    onClick={() => void refreshSuggestions('waivers')}
                  >
                    <RefreshCw
                      className={refreshingSuggestions === 'waivers' ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    {refreshingSuggestions === 'waivers' ? 'Refreshing…' : 'Refresh proposals'}
                  </Button>
                </div>
                {!overview.waiverSuggestions.length ? (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      No strong waiver claims were identified right now.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {overview.waiverSuggestions.map((suggestion) => (
                      <Card key={`${suggestion.add.id}-${suggestion.drop.id}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle>Add {suggestion.add.name}</CardTitle>
                            <Badge variant={suggestion.priority === 'high' ? 'default' : 'secondary'}>
                              {suggestion.priority} priority
                            </Badge>
                          </div>
                          <CardDescription>{suggestion.rationale}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div>
                            <p className="font-medium">Add</p>
                            <PlayerList players={[suggestion.add]} />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <p className="font-medium">Drop</p>
                            <PlayerList players={[suggestion.drop]} />
                          </div>
                          <div className="rounded-md bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Recommended bid</p>
                            <p className="text-lg font-semibold">${suggestion.recommendedBid}</p>
                          </div>
                          <Button className="w-full" asChild>
                            <a href={suggestion.sleeperUrl} target="_blank" rel="noreferrer">
                              Open waivers in Sleeper <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
