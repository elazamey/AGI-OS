// ═══════════════════════════════════════════════════════
// Token Store — OAuth token storage (in-memory)
// ═══════════════════════════════════════════════════════

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  connectedAt: number;
  provider: string;
}

const TOKEN_STORE = new Map<string, StoredToken>();

export function storeToken(providerId: string, token: StoredToken): void {
  TOKEN_STORE.set(providerId, token);
}

export function getStoredToken(providerId: string): StoredToken | undefined {
  return TOKEN_STORE.get(providerId);
}

export function removeToken(providerId: string): boolean {
  return TOKEN_STORE.delete(providerId);
}

export function getAllTokens(): Map<string, StoredToken> {
  return new Map(TOKEN_STORE);
}
