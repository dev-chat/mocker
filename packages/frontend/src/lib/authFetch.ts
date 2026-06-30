import { AUTH_TOKEN_KEY } from '@/app.const';

export function createAuthenticatedRequestInit(init: RequestInit = {}): RequestInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers(init.headers ?? undefined);

  if (token) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  return {
    ...init,
    credentials: 'include',
    headers,
  };
}
