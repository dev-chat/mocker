import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
