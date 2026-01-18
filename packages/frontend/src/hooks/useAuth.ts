import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(apiClient.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedUser = apiClient.getUser();
    const hasToken = apiClient.isAuthenticated();
    setUser(storedUser);
    setIsAuthenticated(hasToken);
  }, []);

  const login = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.authenticateWithSlack(code);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiClient.clearAuth();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const getSlackOAuthUrl = useCallback(() => {
    return apiClient.getSlackOAuthUrl();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getSlackOAuthUrl,
  };
}
