import { describe, it, expect, beforeEach } from 'vitest';
import { PatternDetector } from '../src/patterns.js';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it('should register a pattern', () => {
    const p = detector.register({
      name: 'Network timeout',
      description: 'Repeated network timeouts',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'timeout' }],
      frequency: 'rare',
      impact: 'medium',
    });
    expect(p.id).toBeDefined();
    expect(p.occurrenceCount).toBe(0);
  });

  it('should match pattern by errorType', () => {
    detector.register({
      name: 'Timeout',
      description: 'Timeout errors',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'timeout' }],
      frequency: 'rare',
      impact: 'low',
    });
    const matched = detector.match({ errorType: 'timeout', errorMessage: 'timed out' });
    expect(matched).not.toBeNull();
    expect(matched!.name).toBe('Timeout');
  });

  it('should match pattern by contains', () => {
    detector.register({
      name: 'Auth',
      description: 'Auth failures',
      signatures: [{ field: 'errorMessage', operator: 'contains', value: 'auth' }],
      frequency: 'rare',
      impact: 'high',
    });
    const matched = detector.match({ errorType: 'other', errorMessage: 'authentication failed' });
    expect(matched).not.toBeNull();
  });

  it('should match pattern by regex', () => {
    detector.register({
      name: 'Rate limit',
      description: 'Rate limit errors',
      signatures: [{ field: 'errorMessage', operator: 'matches', value: 'rate.?limit' }],
      frequency: 'rare',
      impact: 'medium',
    });
    const matched = detector.match({ errorType: 'e', errorMessage: 'rate limit exceeded' });
    expect(matched).not.toBeNull();
  });

  it('should not match when signatures differ', () => {
    detector.register({
      name: 'Timeout',
      description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'timeout' }],
      frequency: 'rare',
      impact: 'low',
    });
    const matched = detector.match({ errorType: 'notfound', errorMessage: 'nope' });
    expect(matched).toBeNull();
  });

  it('should report occurrence', () => {
    const p = detector.register({
      name: 'X',
      description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'e' }],
      frequency: 'rare',
      impact: 'low',
    });
    detector.reportOccurrence(p.id);
    detector.reportOccurrence(p.id);
    expect(detector.getPattern(p.id)!.occurrenceCount).toBe(2);
  });

  it('should auto-update frequency', () => {
    const p = detector.register({
      name: 'X',
      description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'e' }],
      frequency: 'rare',
      impact: 'low',
    });
    for (let i = 0; i < 20; i++) detector.reportOccurrence(p.id);
    expect(detector.getPattern(p.id)!.frequency).toBe('systemic');
  });

  it('should detect patterns from errors', () => {
    const errors = [
      { errorType: 'timeout', errorMessage: 'timed out', componentId: 't1', timestamp: '2026-01-01' },
      { errorType: 'timeout', errorMessage: 'timed out', componentId: 't1', timestamp: '2026-01-01' },
    ];
    const detected = detector.detectFromErrors(errors);
    expect(detected).toHaveLength(1);
    expect(detected[0].name).toContain('timeout');
  });

  it('should not detect single error as pattern', () => {
    const errors = [
      { errorType: 'timeout', errorMessage: 'timed out', componentId: 't1', timestamp: '2026-01-01' },
    ];
    expect(detector.detectFromErrors(errors)).toHaveLength(0);
  });

  it('should get by frequency', () => {
    detector.register({
      name: 'A', description: 'a',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'a' }],
      frequency: 'systemic', impact: 'low',
    });
    detector.register({
      name: 'B', description: 'b',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'b' }],
      frequency: 'rare', impact: 'low',
    });
    expect(detector.getByFrequency('systemic')).toHaveLength(1);
  });

  it('should get by impact', () => {
    detector.register({
      name: 'A', description: 'a',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'a' }],
      frequency: 'rare', impact: 'critical',
    });
    expect(detector.getByImpact('critical')).toHaveLength(1);
  });

  it('should get systemic patterns', () => {
    detector.register({
      name: 'A', description: 'a',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'a' }],
      frequency: 'systemic', impact: 'high',
    });
    expect(detector.getSystemicPatterns()).toHaveLength(1);
  });

  it('should get most frequent', () => {
    const p1 = detector.register({
      name: 'A', description: 'a',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'a' }],
      frequency: 'rare', impact: 'low',
    });
    const p2 = detector.register({
      name: 'B', description: 'b',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'b' }],
      frequency: 'rare', impact: 'low',
    });
    detector.reportOccurrence(p1.id);
    detector.reportOccurrence(p1.id);
    detector.reportOccurrence(p2.id);
    expect(detector.getMostFrequent(1)[0].id).toBe(p1.id);
  });

  it('should remove pattern', () => {
    const p = detector.register({
      name: 'X', description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'x' }],
      frequency: 'rare', impact: 'low',
    });
    expect(detector.remove(p.id)).toBe(true);
    expect(detector.getPattern(p.id)).toBeUndefined();
  });

  it('should track occurrence log', () => {
    const p = detector.register({
      name: 'X', description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'x' }],
      frequency: 'rare', impact: 'low',
    });
    detector.reportOccurrence(p.id);
    expect(detector.getOccurrenceLog()).toHaveLength(1);
  });

  it('should reset', () => {
    detector.register({
      name: 'X', description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'x' }],
      frequency: 'rare', impact: 'low',
    });
    detector.reset();
    expect(detector.count()).toBe(0);
  });
});
