import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SearchFiltersCardProps } from '@/components/SearchFiltersCard.model';

export function SearchFiltersCard({
  userName,
  channel,
  content,
  searchFilterOptions,
  isLoading,
  isFiltersLoading,
  activeFilters,
  onUserNameChange,
  onChannelChange,
  onContentChange,
  onSearch,
}: SearchFiltersCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Search Filters</CardTitle>
        <CardDescription>Enter one or more filters to narrow your search. All filters are combined.</CardDescription>
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
              onChange={(e) => onUserNameChange(e.target.value)}
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
              onChange={(e) => onChannelChange(e.target.value)}
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
              onChange={(e) => onContentChange(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button onClick={onSearch} disabled={isLoading}>
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
  );
}
