import { describe, it, expect } from 'vitest';
import { PathGuard } from '../src/path-guard.js';

describe('PathGuard', () => {
  const guard = new PathGuard();

  it('detects path traversal', () => {
    const { safe } = guard.checkPath('../../etc/passwd');
    expect(safe).toBe(false);
  });

  it('blocks system paths', () => {
    const { safe } = guard.checkPath('/etc/shadow');
    expect(safe).toBe(false);
  });

  it('allows workspace paths', () => {
    const { safe } = guard.checkPath('./workspace/file.txt');
    expect(safe).toBe(true);
  });

  it('checks scope', () => {
    expect(guard.isWithinScope('./workspace/file.txt', ['./workspace'])).toBe(true);
    expect(guard.isWithinScope('/etc/passwd', ['./workspace'])).toBe(false);
  });

  it('scans path', () => {
    const result = guard.scan('../../etc/passwd');
    expect(result.passed).toBe(false);
  });
});
