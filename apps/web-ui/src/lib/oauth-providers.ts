// ═══════════════════════════════════════════════════════
// OAuth Provider Configuration — AGI-OS Gateway
// ═══════════════════════════════════════════════════════

export interface OAuthProviderConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google Workspace',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/cse'],
    clientId: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
  github: {
    id: 'github',
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'workflow', 'read:org'],
    clientId: process.env.GITHUB_CLIENT_ID || 'GITHUB_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write', 'files:read'],
    clientId: process.env.SLACK_CLIENT_ID || 'SLACK_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: ['pages', 'databases', 'search'],
    clientId: process.env.NOTION_CLIENT_ID || 'NOTION_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
  jira: {
    id: 'jira',
    name: 'Jira',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'manage:jira-project'],
    clientId: process.env.JIRA_CLIENT_ID || 'JIRA_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: ['issues:create', 'issues:read', 'projects:read'],
    clientId: process.env.LINEAR_CLIENT_ID || 'LINEAR_CLIENT_ID',
    redirectUri: process.env.BASE_URL + '/api/auth/callback',
  },
};

export function buildAuthUrl(providerId: string, state: string): string {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${provider.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(providerId: string, code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const body: Record<string, string> = {
    client_id: provider.clientId,
    client_secret: process.env[`${providerId.toUpperCase()}_CLIENT_SECRET`] || 'CLIENT_SECRET',
    code,
    redirect_uri: provider.redirectUri,
    grant_type: 'authorization_code',
  };

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
