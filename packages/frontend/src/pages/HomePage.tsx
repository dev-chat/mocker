import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ElementType } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MessageSquare, ThumbsUp, Smile, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/hooks/useDashboard';
import type { HomePageProps } from '@/pages/HomePage.model';
import type { TimePeriod } from '@/app.model';
import { API_BASE_URL } from '@/config';
import { createAuthenticatedRequestInit } from '@/lib/authFetch';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];
const POSITIVE_COLOR = '#22c55e';
const NEGATIVE_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#94a3b8';

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'allTime', label: 'All Time' },
];

function periodLabel(period: TimePeriod): string {
  switch (period) {
    case 'daily':
      return 'the last 24 hours';
    case 'weekly':
      return 'the last 7 days';
    case 'monthly':
      return 'the last 30 days';
    case 'yearly':
      return 'the last 365 days';
    case 'allTime':
      return 'all time';
  }
}

function sentimentColor(value: number | null): string {
  if (value === null) return NEUTRAL_COLOR;
  if (value > 0) return POSITIVE_COLOR;
  if (value < 0) return NEGATIVE_COLOR;
  return NEUTRAL_COLOR;
}

function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface BathroomUser {
  slack_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface BathroomTimer {
  id: number;
  start_at: string;
  end_at: string | null;
  duration_seconds: number | null;
}

interface BathroomMeResponse {
  user: BathroomUser;
  active_timer: BathroomTimer | null;
}

interface BathroomLeaderboardEntry {
  slack_id: string;
  display_name: string;
  total_seconds: number;
}

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  iconStyle?: CSSProperties;
}

function StatCard({ icon: Icon, label, value, iconStyle }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" style={iconStyle} aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function HomePage({ onLogout }: HomePageProps) {
  const [period, setPeriod] = useState<TimePeriod>('weekly');
  const [leaderboardDate, setLeaderboardDate] = useState(todayUtcDateString);
  const [bathroomUser, setBathroomUser] = useState<BathroomUser | null>(null);
  const [activeTimer, setActiveTimer] = useState<BathroomTimer | null>(null);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<BathroomLeaderboardEntry[]>([]);
  const [bathroomError, setBathroomError] = useState<string | null>(null);
  const [isBathroomLoading, setIsBathroomLoading] = useState(true);
  const [isTimerSubmitting, setIsTimerSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { data, isLoading, error } = useDashboard(onLogout, period);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer) {
      setNowMs(Date.now());
    }
  }, [activeTimer]);

  const loadBathroomData = useCallback(
    async (date: string) => {
      setIsBathroomLoading(true);
      setBathroomError(null);

      try {
        const [meResponse, leaderboardResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/me`, createAuthenticatedRequestInit()),
          fetch(`${API_BASE_URL}/api/leaderboard?date=${encodeURIComponent(date)}`, createAuthenticatedRequestInit()),
        ]);

        if (meResponse.status === 401 || meResponse.status === 404 || leaderboardResponse.status === 401) {
          onLogout();
          return;
        }

        if (!meResponse.ok) {
          throw new Error('Failed to load bathroom timer state');
        }

        if (!leaderboardResponse.ok) {
          throw new Error('Failed to load bathroom leaderboard');
        }

        const me = (await meResponse.json()) as BathroomMeResponse;
        const leaderboard = (await leaderboardResponse.json()) as BathroomLeaderboardEntry[];
        setBathroomUser(me.user);
        setActiveTimer(me.active_timer);
        setDailyLeaderboard(leaderboard);
      } catch (fetchError) {
        setBathroomError(fetchError instanceof Error ? fetchError.message : 'Failed to load bathroom timer data');
      } finally {
        setIsBathroomLoading(false);
      }
    },
    [onLogout],
  );

  useEffect(() => {
    void loadBathroomData(leaderboardDate);
  }, [leaderboardDate, loadBathroomData]);

  const activeTimerElapsedSeconds = useMemo(() => {
    if (!activeTimer) {
      return 0;
    }

    return Math.max(0, Math.floor((nowMs - new Date(activeTimer.start_at).getTime()) / 1000));
  }, [activeTimer, nowMs]);

  const handleTimerToggle = async () => {
    setIsTimerSubmitting(true);
    setBathroomError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/timer/${activeTimer ? 'stop' : 'start'}`,
        createAuthenticatedRequestInit({ method: 'POST' }),
      );

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: 'Request failed' }))) as { error?: string };
        throw new Error(payload.error ?? 'Request failed');
      }

      await loadBathroomData(leaderboardDate);
    } catch (toggleError) {
      setBathroomError(toggleError instanceof Error ? toggleError.message : 'Failed to update bathroom timer');
    } finally {
      setIsTimerSubmitting(false);
    }
  };

  const avgSentiment = data?.myStats.avgSentiment ?? null;
  const sentimentDisplay =
    avgSentiment !== null ? (avgSentiment > 0 ? `+${avgSentiment.toFixed(2)}` : avgSentiment.toFixed(2)) : '—';

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          <p className="text-muted-foreground mt-2">Your Slack workspace at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Time period">
          {PERIODS.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? 'default' : 'outline'}
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {bathroomError && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">{bathroomError}</p>
          </CardContent>
        </Card>
      )}

      <section aria-label="Bathroom timer and leaderboard">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bathroom Timer</CardTitle>
              <CardDescription>
                {bathroomUser
                  ? `Signed in as ${bathroomUser.display_name}`
                  : 'Track one active bathroom timer at a time.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bathroomUser?.avatar_url && (
                <img
                  src={bathroomUser.avatar_url}
                  alt={bathroomUser.display_name}
                  className="h-12 w-12 rounded-full border object-cover"
                />
              )}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {activeTimer
                    ? `Active since ${new Date(activeTimer.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'No bathroom timer is active right now.'}
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {activeTimer ? formatDuration(activeTimerElapsedSeconds) : isBathroomLoading ? 'Loading…' : '00:00'}
                </p>
              </div>
              <Button onClick={() => void handleTimerToggle()} disabled={isBathroomLoading || isTimerSubmitting}>
                {isTimerSubmitting ? 'Saving…' : activeTimer ? 'Stop timer' : 'Start timer'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Bathroom Leaderboard</CardTitle>
              <CardDescription>Sorted from least to most bathroom time for the selected UTC day.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm font-medium">
                <span className="mb-2 block">Day</span>
                <input
                  type="date"
                  value={leaderboardDate}
                  onChange={(event) => setLeaderboardDate(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
              {isBathroomLoading ? (
                <EmptyState message="Loading bathroom leaderboard…" />
              ) : !dailyLeaderboard.length ? (
                <EmptyState message="No bathroom sessions recorded for this day yet." />
              ) : (
                <ol className="space-y-3">
                  {dailyLeaderboard.map((entry, index) => (
                    <li
                      key={`${entry.slack_id}-${index}`}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{entry.display_name}</p>
                        <p className="text-xs text-muted-foreground">{entry.slack_id}</p>
                      </div>
                      <span className="font-mono text-sm">{formatDuration(entry.total_seconds)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats summary row */}
      <section aria-label="Your stats">
        <h2 className="text-lg font-semibold mb-3">Your Stats</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={MessageSquare}
            label="Messages sent"
            value={isLoading ? '…' : (data?.myStats.totalMessages.toLocaleString() ?? '—')}
          />
          <StatCard
            icon={ThumbsUp}
            label="Reputation score"
            value={isLoading ? '…' : (data?.myStats.rep.toLocaleString() ?? '—')}
          />
          <StatCard
            icon={Smile}
            label="Avg. sentiment"
            value={isLoading ? '…' : sentimentDisplay}
            iconStyle={{ color: sentimentColor(avgSentiment) }}
          />
        </div>
      </section>

      {/* My activity chart */}
      <section aria-label="My message activity">
        <Card>
          <CardHeader>
            <CardTitle>My Message Activity</CardTitle>
            <CardDescription>Messages sent per day over {periodLabel(period)}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <EmptyState message="Loading…" />
            ) : !data?.myActivity.length ? (
              <EmptyState message="No activity data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.myActivity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayLabel}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value ?? 0), 'Messages']}
                    labelFormatter={(label) => formatDayLabel(String(label ?? ''))}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Two-column row: top channels + sentiment trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top channels */}
        <section aria-label="My top channels">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>My Top Channels</CardTitle>
              <CardDescription>Where you spend the most time over {periodLabel(period)}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyState message="Loading…" />
              ) : !data?.myTopChannels.length ? (
                <EmptyState message="No channel data available yet." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.myTopChannels}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="channel"
                      width={90}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => (v.startsWith('#') ? v : `#${v}`)}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0), 'Messages']}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {data.myTopChannels.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Sentiment trend */}
        <section aria-label="My sentiment trend">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>My Sentiment Trend</CardTitle>
              <CardDescription>Weekly average sentiment score over {periodLabel(period)}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyState message="Loading…" />
              ) : !data?.mySentimentTrend.length ? (
                <EmptyState message="No sentiment data available yet." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.mySentimentTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="weekStart"
                      tickFormatter={formatWeekLabel}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0).toFixed(2), 'Sentiment']}
                      labelFormatter={(label) => formatWeekLabel(String(label ?? ''))}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgSentiment"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS[0], r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Two-column row: workspace leaderboard + rep leaderboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Workspace message leaderboard */}
        <section aria-label="Workspace message leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>Most Active Members</CardTitle>
              <CardDescription>Top 10 workspace members by message count over {periodLabel(period)}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyState message="Loading…" />
              ) : !data?.leaderboard.length ? (
                <EmptyState message="No leaderboard data available yet." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.leaderboard} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Messages']}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Rep leaderboard */}
        <section aria-label="Reputation leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>Reputation Standings</CardTitle>
              <CardDescription>Top 10 members by reputation received over {periodLabel(period)}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyState message="Loading…" />
              ) : !data?.repLeaderboard.length ? (
                <EmptyState message="No reputation data available yet." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.repLeaderboard}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Rep']}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="rep" fill={CHART_COLORS[2]} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
