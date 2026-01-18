import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from './Pagination';
import { MessageSquare, User, Hash, Clock } from 'lucide-react';
import type { SearchResults } from '@/types';

interface ResultsTableProps {
  results: SearchResults | undefined;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (offset: number) => void;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-12 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ResultsTable({ results, isLoading, isFetching, onPageChange }: ResultsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!results || results.messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No messages found. Try adjusting your search criteria.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isFetching ? 'opacity-75' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Results
          </CardTitle>
          {isFetching && (
            <span className="text-sm text-muted-foreground animate-pulse">Updating...</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  User
                </div>
              </TableHead>
              <TableHead className="w-[140px]">
                <div className="flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  Channel
                </div>
              </TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-[180px]">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Time
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <Badge variant="secondary">{message.userName}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    #{message.channelName || message.channel}
                  </span>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate">{message.message}</p>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination
          total={results.total}
          limit={results.limit}
          offset={results.offset}
          onPageChange={onPageChange}
          isLoading={isFetching}
        />
      </CardContent>
    </Card>
  );
}
