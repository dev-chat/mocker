import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SearchParams } from '@/types';

export function useSearchMessages(params: SearchParams, enabled = true) {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: () => apiClient.searchMessages(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
