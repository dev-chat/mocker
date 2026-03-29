import type { Message, SortKey, SortDirection } from '@/app.model';

export interface SearchResultsCardProps {
  hasSearched: boolean;
  isLoading: boolean;
  total: number;
  tableFilter: string;
  displayedMessages: Message[];
  messages: Message[];
  mentions: Record<string, string>;
  currentPage: number;
  totalPages: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onTableFilterChange: (value: string) => void;
  onToggleSort: (key: SortKey) => void;
  onUserClick: (name: string) => void;
  onChannelClick: (name: string) => void;
  onFetchPage: (page: number) => void;
}
