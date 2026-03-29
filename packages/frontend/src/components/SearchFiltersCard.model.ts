import type { SearchFiltersResponse } from '@/app.model';

export interface ActiveFilter {
  label: string;
  value: string;
}

export interface SearchFiltersCardProps {
  userName: string;
  channel: string;
  content: string;
  searchFilterOptions: SearchFiltersResponse;
  isLoading: boolean;
  isFiltersLoading: boolean;
  activeFilters: ActiveFilter[];
  onUserNameChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSearch: () => void;
}
