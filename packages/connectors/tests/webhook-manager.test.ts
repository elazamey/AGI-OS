import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookManager } from '../src/webhook-manager.js';

describe('WebhookManager', () => {
  let mgr: WebhookManager;
  beforeEach(() => { mgr = new WebhookManager(); });

  it('subscribes', () => {
    const sub = mgr.subscribe('issue.created', 'http://localhost/hook');
    expect(sub.id).toBeDefined();
    expect(sub.active).toBe(true);
  });

  it('receives payload', () => {
    mgr.receivePayload({ id: 'p1', event: 'issue.created', source: 'github', data: {}, timestamp: new Date().toISOString() });
    expect(mgr.getReceived().length).toBe(1);
  });

  it('filters by event', () => {
    mgr.receivePayload({ id: 'p1', event: 'issue.created', source: 'github', data: {}, timestamp: new Date().toISOString() });
    mgr.receivePayload({ id: 'p2', event: 'pr.merged', source: 'github', data: {}, timestamp: new Date().toISOString() });
    expect(mgr.getReceived('issue.created').length).toBe(1);
  });

  it('unsubscribes', () => {
    const sub = mgr.subscribe('test', 'http://test');
    expect(mgr.unsubscribe(sub.id)).toBe(true);
  });

  it('gets stats', () => {
    mgr.subscribe('test', 'http://test');
    const stats = mgr.getStats();
    expect(stats.subscriptions).toBe(1);
  });
});
