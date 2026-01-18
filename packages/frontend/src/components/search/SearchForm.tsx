import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchFilters } from './SearchFilters';
import { Search, X, Filter } from 'lucide-react';
import type { SearchParams } from '@/types';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading?: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch({
        query: query || undefined,
        userId: userId || undefined,
        channelId: channelId || undefined,
        startDate: startDate || undefined,
        endDate: endDate ? `${endDate}T23:59:59` : undefined,
        offset: 0,
      });
    },
    [query, userId, channelId, startDate, endDate, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setUserId('');
    setChannelId('');
    setStartDate('');
    setEndDate('');
    onSearch({ offset: 0 });
  }, [onSearch]);

  const hasFilters = userId || channelId || startDate || endDate;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search messages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              type="button"
              variant={showFilters ? 'secondary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <SearchFilters
              userId={userId}
              channelId={channelId}
              startDate={startDate}
              endDate={endDate}
              onUserChange={setUserId}
              onChannelChange={setChannelId}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          )}

          {hasFilters && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                Clear all filters
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
