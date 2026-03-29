import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchFiltersCard } from '@/components/SearchFiltersCard';
import { SearchResultsCard } from '@/components/SearchResultsCard';
import type { Message, SearchFiltersResponse, SearchMessagesResponse, SortKey, SortDirection } from '@/app.model';
import type { ActiveFilter } from '@/components/SearchFiltersCard.model';
import { AUTH_TOKEN_KEY, PAGE_SIZE } from '@/app.const';
import { API_BASE_URL } from '@/config';
import { getDisplayedMessages } from '@/app.helpers';
import type { MessageSearchPageProps } from '@/pages/MessageSearchPage.model';

export function MessageSearchPage({ onLogout }: MessageSearchPageProps) {
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

  const fetchPage = useCallback(
    async (page: number) => {
      setIsLoading(true);
      setHasSearched(true);
      setError(null);

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
          onLogout();
          return;
        }
        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = (await response.json()) as SearchMessagesResponse;
        setMessages(data.messages);
        setMentions(data.mentions);
        setTotal(data.total);
        setCurrentPage(page);
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
    [userName, channel, content, onLogout],
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
        onLogout();
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
  }, [onLogout]);

  useEffect(() => {
    void loadSearchFilters();
  }, [loadSearchFilters]);

  // Abort any in-flight request on unmount to prevent state updates on an unmounted component
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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

  const activeFilters = [
    userName.trim() && { label: 'User', value: userName.trim() },
    channel.trim() && { label: 'Channel', value: channel.trim() },
    content.trim() && { label: 'Content', value: content.trim() },
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Message Search</h1>
        <p className="text-muted-foreground mt-2">Search through Slack messages by user, channel, or content.</p>
      </div>

      <SearchFiltersCard
        userName={userName}
        channel={channel}
        content={content}
        searchFilterOptions={searchFilterOptions}
        isLoading={isLoading}
        isFiltersLoading={isFiltersLoading}
        activeFilters={activeFilters}
        onUserNameChange={setUserName}
        onChannelChange={setChannel}
        onContentChange={setContent}
        onSearch={() => void handleSearch()}
      />

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      <SearchResultsCard
        hasSearched={hasSearched}
        isLoading={isLoading}
        total={total}
        tableFilter={tableFilter}
        displayedMessages={displayedMessages}
        messages={messages}
        mentions={mentions}
        currentPage={currentPage}
        totalPages={totalPages}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onTableFilterChange={setTableFilter}
        onToggleSort={toggleSort}
        onUserClick={setUserName}
        onChannelClick={setChannel}
        onFetchPage={(page) => void fetchPage(page)}
      />
    </div>
  );
}
