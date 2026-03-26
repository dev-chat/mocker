import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { LoginPage } from '@/components/LoginPage';
import type { Message } from '@/app.model';
import { AUTH_TOKEN_KEY } from '@/app.const';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export default function App() {
  const { isAuthenticated, authError, logout } = useAuth();
  const [userName, setUserName] = useState('');
  const [channel, setChannel] = useState('');
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleLogout = useCallback(() => {
    logout(() => {
      setMessages([]);
      setHasSearched(false);
      setError(null);
    });
  }, [logout]);

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (userName.trim()) params.set('userName', userName.trim());
    if (channel.trim()) params.set('channel', channel.trim());
    if (content.trim()) params.set('content', content.trim());

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const response = await fetch(`${API_BASE_URL}/search/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const data: Message[] = (await response.json()) as Message[];
      setMessages(data);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [userName, channel, content, handleLogout]);

  // Debounced search-as-you-type: skip the initial render, then trigger a search
  // 300ms after the user stops changing userName, channel, or content.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const activeFilters = [
    userName.trim() && { label: 'User', value: userName.trim() },
    channel.trim() && { label: 'Channel', value: channel.trim() },
    content.trim() && { label: 'Content', value: content.trim() },
  ].filter(Boolean) as { label: string; value: string }[];

  if (!isAuthenticated) {
    return <LoginPage authError={authError} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Message Search</h1>
            <p className="text-muted-foreground mt-2">Search through Slack messages by user, channel, or content.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Filters</CardTitle>
            <CardDescription>
              Enter one or more filters to narrow your search. All filters are combined.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="userName">User Name</Label>
                <Input
                  id="userName"
                  placeholder="e.g. john"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Input
                  id="channel"
                  placeholder="e.g. general"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Message Content</Label>
                <Input
                  id="content"
                  placeholder="e.g. hello world"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Button onClick={() => void handleSearch()} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <Badge key={filter.label} variant="secondary">
                      {filter.label}: {filter.value}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {hasSearched && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {messages.length === 0
                  ? 'No messages found matching your search criteria.'
                  : `Found ${messages.length} message${messages.length === 1 ? '' : 's'}`}
              </CardDescription>
            </CardHeader>
            {messages.length > 0 && (
              <>
                <Separator />
                <CardContent className="pt-4 p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">User</TableHead>
                        <TableHead className="w-[140px]">Channel</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-[180px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-medium">{msg.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">#{msg.channel}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <span className="break-words">{msg.message}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(msg.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
