import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.getChannels(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
