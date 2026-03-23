export interface SlackTokenResponse {
  ok: boolean;
  authed_user?: {
    id: string;
    access_token: string;
  };
}

export interface SlackIdentityResponse {
  ok: boolean;
  user?: {
    id: string;
    name: string;
  };
  team?: {
    domain: string;
    id: string;
  };
}
