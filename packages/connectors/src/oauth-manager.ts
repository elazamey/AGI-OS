import { generateId, now } from '@agi-os/kernel';
import type { AuthCredentials } from './types.js';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scopes: string[];
}

export class OAuthManager {
  private configs: Map<string, OAuthConfig> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();

  registerProvider(id: string, config: OAuthConfig): void {
    this.configs.set(id, config);
  }

  getAuthUrl(providerId: string, state?: string): string | undefined {
    const config = this.configs.get(providerId);
    if (!config) return undefined;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state: state || generateId(),
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCode(providerId: string, code: string): Promise<OAuthToken | null> {
    const config = this.configs.get(providerId);
    if (!config) return null;

    const token: OAuthToken = {
      accessToken: `mock_${generateId()}`,
      refreshToken: `refresh_${generateId()}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      tokenType: 'Bearer',
      scopes: config.scopes,
    };
    this.tokens.set(providerId, token);
    return token;
  }

  getToken(providerId: string): OAuthToken | undefined {
    return this.tokens.get(providerId);
  }

  getCredentials(providerId: string): AuthCredentials | null {
    const token = this.tokens.get(providerId);
    if (!token) return null;
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
    };
  }

  isExpired(providerId: string): boolean {
    const token = this.tokens.get(providerId);
    if (!token) return true;
    return new Date(token.expiresAt) < new Date();
  }

  async refresh(providerId: string): Promise<OAuthToken | null> {
    const existing = this.tokens.get(providerId);
    if (!existing?.refreshToken) return null;
    const newToken: OAuthToken = {
      ...existing,
      accessToken: `refreshed_${generateId()}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    this.tokens.set(providerId, newToken);
    return newToken;
  }

  revoke(providerId: string): void {
    this.tokens.delete(providerId);
  }

  getConnectedProviders(): string[] {
    return Array.from(this.tokens.keys());
  }
}
