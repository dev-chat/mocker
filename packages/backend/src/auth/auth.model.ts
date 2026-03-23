import type { OauthV2AccessResponse, UsersIdentityResponse } from '@slack/web-api';

// Re-use the Slack SDK type for the OAuth token exchange response.
export type SlackTokenResponse = OauthV2AccessResponse;

// Re-use the Slack SDK identity response type and extend it with `team.domain`,
// which the SDK's auto-generated types omit but the users.identity API does return.
export type SlackIdentityResponse = UsersIdentityResponse & {
  team?: {
    domain?: string;
  };
};
