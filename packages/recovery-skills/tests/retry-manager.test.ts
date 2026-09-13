import { describe, it, expect, beforeEach } from 'vitest';
import { RetryManager } from '../src/retry-manager.js';

describe('RetryManager', () => {
  let mgr: RetryManager;
  beforeEach(() => { mgr = new RetryManager(); });

  it('allows retry within limit', () => {
    expect(mgr.shouldRetry('s1', 3)).toBe(true);
    mgr.recordRetry('s1', 'error');
    expect(mgr.shouldRetry('s1', 3)).toBe(true);
  });

  it('blocks retry after limit', () => {
    mgr.recordRetry('s1', 'e1');
    mgr.recordRetry('s1', 'e2');
    mgr.recordRetry('s1', 'e3');
    expect(mgr.shouldRetry('s1', 3)).toBe(false);
  });

  it('tracks retry count', () => {
    mgr.recordRetry('s1', 'e');
    mgr.recordRetry('s1', 'e');
    expect(mgr.getRetryCount('s1')).toBe(2);
  });

  it('records skip action', () => {
    const action = mgr.recordSkip('s1', 'not critical');
    expect(action.type).toBe('skip');
  });

  it('records abort action', () => {
    const action = mgr.recordAbort('s1', 'fatal');
    expect(action.type).toBe('abort');
  });

  it('gets actions', () => {
    mgr.recordRetry('s1', 'e');
    mgr.recordSkip('s2', 'skip');
    expect(mgr.getActions('s1').length).toBe(1);
    expect(mgr.getActions().length).toBe(2);
  });

  it('clears', () => {
    mgr.recordRetry('s1', 'e');
    mgr.clear();
    expect(mgr.getActions().length).toBe(0);
  });
});
