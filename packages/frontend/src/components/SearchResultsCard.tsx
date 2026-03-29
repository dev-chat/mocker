import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { MessageText } from '@/components/MessageText';
import type { SortKey } from '@/app.model';
import type { SearchResultsCardProps } from '@/components/SearchResultsCard.model';

function sortIconFor(column: SortKey, sortKey: SortKey, sortDirection: 'asc' | 'desc') {
  if (sortKey !== column) {
    return <ArrowUpDown className="ml-2 h-3.5 w-3.5" aria-hidden="true" />;
  }
  return sortDirection === 'asc' ? (
    <ArrowUp className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
  );
}

export function SearchResultsCard({
  hasSearched,
  isLoading,
  total,
  tableFilter,
  displayedMessages,
  messages,
  mentions,
  currentPage,
  totalPages,
  sortKey,
  sortDirection,
  onTableFilterChange,
  onToggleSort,
  onUserClick,
  onChannelClick,
  onFetchPage,
}: SearchResultsCardProps) {
  if (!hasSearched) {
    return null;
  }

  const resultsDescription = isLoading
    ? 'Loading results...'
    : total === 0
      ? 'No messages found matching your search criteria.'
      : `Found ${total} message${total === 1 ? '' : 's'} overall${tableFilter.trim() ? ` (${displayedMessages.length} shown)` : ''}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>{resultsDescription}</CardDescription>
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
                onChange={(e) => onTableFilterChange(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="overflow-y-auto max-h-[50vh] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">
                      <Button variant="ghost" size="sm" onClick={() => onToggleSort('name')}>
                        User
                        {sortIconFor('name', sortKey, sortDirection)}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <Button variant="ghost" size="sm" onClick={() => onToggleSort('channel')}>
                        Channel
                        {sortIconFor('channel', sortKey, sortDirection)}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => onToggleSort('message')}>
                        Message
                        {sortIconFor('message', sortKey, sortDirection)}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[180px]">
                      <Button variant="ghost" size="sm" onClick={() => onToggleSort('createdAt')}>
                        Date
                        {sortIconFor('createdAt', sortKey, sortDirection)}
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
                          onUserClick={onUserClick}
                          onChannelClick={onChannelClick}
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
                    onClick={() => onFetchPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFetchPage(currentPage + 1)}
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
  );
}
