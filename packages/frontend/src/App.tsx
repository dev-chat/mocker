import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Loader2, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { LoginPage } from '@/components/LoginPage';
import { MessageText } from '@/components/MessageText';
import type { Message, SearchFiltersResponse, SearchMessagesResponse, SortKey, SortDirection } from '@/app.model';
import { AUTH_TOKEN_KEY, PAGE_SIZE } from '@/app.const';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/config';
import { getDisplayedMessages } from '@/app.helpers';

export default function App() {
  const { isAuthenticated, authError, logout } = useAuth();
  const [userName, setUserName] = useState('');
  const [channel, setChannel] = useState('');
  const [content, setContent] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchFilterOptions, setSearchFilterOptions] = useState<SearchFiltersResponse>({ users: [], channels: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [mentions, setMentions] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleLogout = useCallback(() => {
    logout(() => {
      setMessages([]);
      setMentions({});
      setHasSearched(false);
      setError(null);
      setTotal(0);
      setCurrentPage(1);
    });
  }, [logout]);

  const fetchPage = useCallback(
    async (page: number) => {
      setIsLoading(true);
      setHasSearched(true);
      setError(null);
      setCurrentPage(page);

      // Abort any previous in-flight request to prevent stale results
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create a new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const params = new URLSearchParams();
      if (userName.trim()) params.set('userName', userName.trim());
      if (channel.trim()) params.set('channel', channel.trim());
      if (content.trim()) params.set('content', content.trim());
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));

      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
        const response = await fetch(`${API_BASE_URL}/search/messages?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });
        if (response.status === 401) {
          handleLogout();
          return;
        }
        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = (await response.json()) as SearchMessagesResponse;
        setMessages(data.messages);
        setMentions(data.mentions);
        setTotal(data.total);
      } catch (err) {
        // Ignore abort errors from cancelled requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [userName, channel, content, handleLogout],
  );

  const handleSearch = useCallback(() => fetchPage(1), [fetchPage]);

  const loadSearchFilters = useCallback(async () => {
    setIsFiltersLoading(true);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const response = await fetch(`${API_BASE_URL}/search/filters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to load search filters: ${response.statusText}`);
      }
      const data = (await response.json()) as SearchFiltersResponse;
      setSearchFilterOptions({ users: data.users ?? [], channels: data.channels ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search filters');
    } finally {
      setIsFiltersLoading(false);
    }
  }, [handleLogout]);

  // Debounced search-as-you-type: skip the initial render, then trigger a search
  // 300ms after the user stops changing userName, channel, or content.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadSearchFilters();
  }, [isAuthenticated, loadSearchFilters]);

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

  const displayedMessages = useMemo(
    () => getDisplayedMessages(messages, tableFilter, sortKey, sortDirection),
    [messages, tableFilter, sortKey, sortDirection],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = useCallback(
    (nextKey: SortKey) => {
      if (sortKey === nextKey) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortKey(nextKey);
      setSortDirection(nextKey === 'createdAt' ? 'desc' : 'asc');
    },
    [sortKey],
  );

  const sortIconFor = useCallback(
    (column: SortKey) => {
      if (sortKey !== column) {
        return <ArrowUpDown className="ml-2 h-3.5 w-3.5" aria-hidden="true" />;
      }
      return sortDirection === 'asc' ? (
        <ArrowUp className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
      );
    },
    [sortKey, sortDirection],
  );

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
                  list="user-filter-options"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                <datalist id="user-filter-options">
                  {searchFilterOptions.users.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Input
                  id="channel"
                  placeholder="e.g. general"
                  list="channel-filter-options"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                />
                <datalist id="channel-filter-options">
                  {searchFilterOptions.channels.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
              {isFiltersLoading && <p className="text-muted-foreground text-xs">Loading user/channel suggestions...</p>}
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
                {isLoading
                  ? 'Loading results...'
                  : total === 0
                    ? 'No messages found matching your search criteria.'
                    : `Found ${total} message${total === 1 ? '' : 's'} overall${tableFilter.trim() ? ` (${displayedMessages.length} shown)` : ''}`}
              </CardDescription>
            </CardHeader>
            {isLoading ? (
              <CardContent className="pt-2">
                <div className="text-muted-foreground flex min-h-[160px] items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading results...
                </div>
              </CardContent>
            ) : messages.length > 0 ? (
              <>
                <Separator />
                <CardContent className="pt-4">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Input
                      aria-label="Filter result rows"
                      placeholder="Filter results by user, channel, or message"
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                  <div className="overflow-y-auto max-h-[50vh] rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">
                            <Button variant="ghost" size="sm" onClick={() => toggleSort('name')}>
                              User
                              {sortIconFor('name')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[140px]">
                            <Button variant="ghost" size="sm" onClick={() => toggleSort('channel')}>
                              Channel
                              {sortIconFor('channel')}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSort('message')}>
                              Message
                              {sortIconFor('message')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[180px]">
                            <Button variant="ghost" size="sm" onClick={() => toggleSort('createdAt')}>
                              Date
                              {sortIconFor('createdAt')}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedMessages.map((msg) => (
                          <TableRow key={msg.id}>
                            <TableCell className="font-medium">{msg.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">#{msg.channelName ?? msg.channel}</Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <MessageText
                                text={msg.message}
                                mentions={mentions}
                                onUserClick={(name) => setUserName(name)}
                                onChannelClick={(name) => setChannel(name)}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(msg.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {displayedMessages.length === 0 && (
                    <p className="text-muted-foreground mt-4 text-sm">No rows match your result filter.</p>
                  )}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchPage(currentPage + 1)}
                          disabled={currentPage >= totalPages}
                          aria-label="Next page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            ) : null}
          </Card>
        )}
      </div>
    </div>
  );
}
