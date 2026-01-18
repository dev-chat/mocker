import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSearchMessages } from '@/hooks/useSearchMessages';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchForm } from '@/components/search/SearchForm';
import { ResultsTable } from '@/components/results/ResultsTable';
import { Button } from '@/components/ui/button';
import { LogOut, MessageSquare } from 'lucide-react';
import type { SearchParams } from '@/types';

export function SearchPage() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const debouncedParams = useDebounce(searchParams, 300);

  const { data: results, isLoading, isFetching } = useSearchMessages(debouncedParams, true);

  const handleSearch = useCallback((params: SearchParams) => {
    setSearchParams((prev) => ({ ...prev, ...params, offset: params.offset ?? 0 }));
  }, []);

  const handlePageChange = useCallback((offset: number) => {
    setSearchParams((prev) => ({ ...prev, offset }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Slack Message Search</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Signed in as <strong>{user?.userName}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <SearchForm onSearch={handleSearch} isLoading={isFetching} />
        <ResultsTable
          results={results}
          isLoading={isLoading}
          isFetching={isFetching}
          onPageChange={handlePageChange}
        />
      </main>
    </div>
  );
}
