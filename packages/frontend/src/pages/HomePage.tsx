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
import { useDashboard } from '@/hooks/useDashboard';
import type { HomePageProps } from '@/pages/HomePage.model';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];
const POSITIVE_COLOR = '#22c55e';
const NEGATIVE_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#94a3b8';

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

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconStyle?: React.CSSProperties;
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
  const { data, isLoading, error } = useDashboard(onLogout);

  const avgSentiment = data?.myStats.avgSentiment ?? null;
  const sentimentDisplay =
    avgSentiment !== null ? (avgSentiment > 0 ? `+${avgSentiment.toFixed(2)}` : avgSentiment.toFixed(2)) : '—';

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground mt-2">Your Slack workspace at a glance.</p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

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
            <CardDescription>Messages sent per day over the last 30 days</CardDescription>
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
              <CardDescription>Where you spend the most time</CardDescription>
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
              <CardDescription>Weekly average sentiment score over the last 12 weeks</CardDescription>
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
              <CardDescription>Top 10 workspace members by message count</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyState message="Loading…" />
              ) : !data?.leaderboard.length ? (
                <EmptyState message="No leaderboard data available yet." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.leaderboard}
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
              <CardDescription>Top 10 members by reputation received</CardDescription>
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

