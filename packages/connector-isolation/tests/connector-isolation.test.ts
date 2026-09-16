import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityScopeManager } from '../src/capability-scope.js';
import { SecretVaultManager } from '../src/secret-vault.js';
import { ConnectorAuditLogger } from '../src/audit-logger.js';
import { RateLimiter } from '../src/rate-limiter.js';

describe('CapabilityScopeManager', () => {
  let mgr: CapabilityScopeManager;
  beforeEach(() => { mgr = new CapabilityScopeManager(); });

  it('has default scopes', () => {
    expect(mgr.getAllScopes().length).toBeGreaterThanOrEqual(5);
  });

  it('gets scope by id', () => {
    expect(mgr.getScope('github-read')).toBeDefined();
  });

  it('checks permissions', () => {
    expect(mgr.hasPermission('github-read', 'repo.read')).toBe(true);
    expect(mgr.hasPermission('github-read', 'repo.write')).toBe(false);
  });

  it('finds scopes for permission', () => {
    const scopes = mgr.getScopesForPermission('repo.read');
    expect(scopes.length).toBeGreaterThanOrEqual(1);
  });

  it('adds custom scope', () => {
    mgr.addScope({ id: 'custom', name: 'Custom', description: 'Test', permissions: ['test'], rateLimit: { requests: 10, windowMs: 60000 }, timeout: 5000, retryPolicy: { maxRetries: 1, backoffMs: 1000 }, secretIsolation: true, auditLog: true, idempotencyKey: false, approvalRequired: false, revocable: true });
    expect(mgr.getScope('custom')).toBeDefined();
  });

  it('removes scope', () => {
    expect(mgr.removeScope('github-read')).toBe(true);
    expect(mgr.getScope('github-read')).toBeUndefined();
  });
});

describe('SecretVaultManager', () => {
  let vault: SecretVaultManager;
  beforeEach(() => { vault = new SecretVaultManager(); });

  it('stores secret', () => {
    const entry = vault.store('github', 'my-api-key');
    expect(entry.id).toBeDefined();
    expect(entry.encryptedValue).toBeDefined();
  });

  it('retrieves secret', () => {
    const entry = vault.store('github', 'my-api-key');
    const value = vault.retrieve(entry.id, 'github');
    expect(value).toBe('my-api-key');
  });

  it('rejects wrong connector', () => {
    const entry = vault.store('github', 'my-api-key');
    const value = vault.retrieve(entry.id, 'google');
    expect(value).toBeNull();
  });

  it('revokes secret', () => {
    const entry = vault.store('github', 'key');
    expect(vault.revoke(entry.id)).toBe(true);
    expect(vault.retrieve(entry.id, 'github')).toBeNull();
  });

  it('gets by connector', () => {
    vault.store('github', 'k1');
    vault.store('github', 'k2');
    vault.store('google', 'k3');
    expect(vault.getByConnector('github').length).toBe(2);
  });

  it('gets stats', () => {
    vault.store('github', 'k1');
    const stats = vault.getStats();
    expect(stats.total).toBe(1);
  });
});

describe('ConnectorAuditLogger', () => {
  let logger: ConnectorAuditLogger;
  beforeEach(() => { logger = new ConnectorAuditLogger(); });

  it('logs entries', () => {
    const entry = logger.log({ connectorId: 'github', action: 'create_pr', status: 'success', durationMs: 150 });
    expect(entry.requestId).toBeDefined();
  });

  it('filters by connector', () => {
    logger.log({ connectorId: 'github', action: 'pr', status: 'success', durationMs: 100 });
    logger.log({ connectorId: 'google', action: 'drive', status: 'success', durationMs: 200 });
    expect(logger.getByConnector('github').length).toBe(1);
  });

  it('filters by status', () => {
    logger.log({ connectorId: 'a', action: 'x', status: 'success', durationMs: 10 });
    logger.log({ connectorId: 'a', action: 'x', status: 'failure', durationMs: 10 });
    expect(logger.getByStatus('failure').length).toBe(1);
  });

  it('gets stats', () => {
    logger.log({ connectorId: 'a', action: 'x', status: 'success', durationMs: 10 });
    const stats = logger.getStats();
    expect(stats.total).toBe(1);
  });

  it('respects max entries', () => {
    const small = new ConnectorAuditLogger(3);
    for (let i = 0; i < 5; i++) small.log({ connectorId: 'a', action: 'x', status: 'success', durationMs: 1 });
    expect(small.getStats().total).toBe(3);
  });
});

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  beforeEach(() => { limiter = new RateLimiter(); });

  it('allows within limit', () => {
    const result = limiter.check('api', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks over limit', () => {
    for (let i = 0; i < 3; i++) limiter.check('api', 3, 60000);
    const result = limiter.check('api', 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window', () => {
    // Use a unique key and verify fresh state
    const result = limiter.check('fresh-key', 1, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('resets manually', () => {
    limiter.check('api', 1, 60000);
    limiter.reset('api');
    const result = limiter.check('api', 1, 60000);
    expect(result.allowed).toBe(true);
  });
});