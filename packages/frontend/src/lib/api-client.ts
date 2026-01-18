import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  User,
  SlackUser,
  SlackChannel,
  SearchResults,
  SearchParams,
  ApiError,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'slack_search_token';
const USER_KEY = 'slack_search_user';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/search`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch {
        return null;
      }
    }
    return null;
  }

  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async authenticateWithSlack(code: string): Promise<AuthResponse> {
    const response = await this.client.get<AuthResponse>('/auth/slack', {
      params: { code },
    });
    const { token, user } = response.data;
    this.setToken(token);
    this.setUser(user);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  async searchMessages(params: SearchParams): Promise<SearchResults> {
    const response = await this.client.get<SearchResults>('/messages', { params });
    return response.data;
  }

  async getUsers(): Promise<SlackUser[]> {
    const response = await this.client.get<SlackUser[]>('/users');
    return response.data;
  }

  async getChannels(): Promise<SlackChannel[]> {
    const response = await this.client.get<SlackChannel[]>('/channels');
    return response.data;
  }

  getSlackOAuthUrl(): string {
    const clientId = import.meta.env.VITE_SLACK_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'identity.basic,identity.team';

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}

export const apiClient = new ApiClient();
