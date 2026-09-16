import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthManager } from '../src/oauth-manager.js';

describe('OAuthManager', () => {
  let mgr: OAuthManager;
  beforeEach(() => {
    mgr = new OAuthManager();
    mgr.registerProvider('google', { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost', scopes: ['drive'], authUrl: 'https://accounts.google.com/o/oauth2/auth', tokenUrl: 'https://oauth2.googleapis.com/token' });
  });

  it('generates auth url', () => {
    const url = mgr.getAuthUrl('google');
    expect(url).toContain('client_id=id');
    expect(url).toContain('response_type=code');
  });

  it('exchanges code', async () => {
    const token = await mgr.exchangeCode('google', 'auth_code');
    expect(token).not.toBeNull();
    expect(token?.accessToken).toBeDefined();
  });

  it('gets credentials', async () => {
    await mgr.exchangeCode('google', 'code');
    const creds = mgr.getCredentials('google');
    expect(creds).not.toBeNull();
    expect(creds?.accessToken).toBeDefined();
  });

  it('checks expiry', async () => {
    await mgr.exchangeCode('google', 'code');
    expect(mgr.isExpired('google')).toBe(false);
  });

  it('revokes', async () => {
    await mgr.exchangeCode('google', 'code');
    mgr.revoke('google');
    expect(mgr.getToken('google')).toBeUndefined();
  });
});
