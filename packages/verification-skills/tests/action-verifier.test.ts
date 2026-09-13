import { describe, it, expect } from 'vitest';
import { ActionVerifier } from '../src/action-verifier.js';

describe('ActionVerifier', () => {
  const verifier = new ActionVerifier();

  it('verifies matching output', () => {
    const result = verifier.verify({
      skillId: 'test',
      action: 'run',
      expectedOutput: 'ok',
      actualOutput: 'ok',
      level: 'BASIC',
    });
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects mismatch', () => {
    const result = verifier.verify({
      skillId: 'test',
      action: 'run',
      expectedOutput: 'ok',
      actualOutput: 'fail',
      level: 'STRICT',
    });
    expect(result.verified).toBe(false);
  });

  it('includes evidence', () => {
    const result = verifier.verify({
      skillId: 'test',
      action: 'run',
      actualOutput: 'ok',
      level: 'BASIC',
    });
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const r1 = verifier.verify({
      skillId: 'test',
      action: 'a',
      actualOutput: null,
      level: 'BASIC',
    });
    const r2 = verifier.verify({
      skillId: 'test',
      action: 'a',
      actualOutput: null,
      level: 'BASIC',
    });
    expect(r1.id).not.toBe(r2.id);
  });

  it('proof level includes hash', () => {
    const result = verifier.verify({
      skillId: 'test',
      action: 'run',
      actualOutput: { data: 42 },
      level: 'PROOF',
    });
    expect(result.evidence.some((e) => e.type === 'hash_match')).toBe(true);
  });
});
