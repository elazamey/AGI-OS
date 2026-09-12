import { describe, it, expect, beforeEach } from 'vitest';
import { ReliabilityTracker } from '../src/reliability.js';

describe('ReliabilityTracker', () => {
  let tracker: ReliabilityTracker;

  beforeEach(() => {
    tracker = new ReliabilityTracker();
  });

  it('should create record on first access', () => {
    const rec = tracker.getOrCreate('tool-1', 'tool');
    expect(rec.componentId).toBe('tool-1');
    expect(rec.componentType).toBe('tool');
    expect(rec.successRate).toBe(0);
  });

  it('should record success', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordSuccess('t1', 100);
    const rec = tracker.getRecord('t1')!;
    expect(rec.consecutiveSuccesses).toBe(1);
    expect(rec.totalUptimeMs).toBe(100);
  });

  it('should record failure', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordFailure('t1', 'timeout', 'timed out', 50);
    const rec = tracker.getRecord('t1')!;
    expect(rec.consecutiveFailures).toBe(1);
    expect(rec.lastFailureAt).toBeDefined();
    expect(rec.failureHistory).toHaveLength(1);
  });

  it('should record recovery', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordFailure('t1', 'timeout', 'timed out', 50);
    tracker.recordRecovery('t1', 200);
    const rec = tracker.getRecord('t1')!;
    expect(rec.lastRecoveryAt).toBeDefined();
    expect(rec.failureHistory[0].recovered).toBe(true);
    expect(rec.failureHistory[0].recoveryTimeMs).toBe(200);
  });

  it('should reset consecutive failures on success', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordFailure('t1', 'e', 'm', 10);
    tracker.recordFailure('t1', 'e', 'm', 10);
    tracker.recordSuccess('t1', 10);
    expect(tracker.getRecord('t1')!.consecutiveFailures).toBe(0);
    expect(tracker.getRecord('t1')!.consecutiveSuccesses).toBe(1);
  });

  it('should compute success rate', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordSuccess('t1', 100);
    tracker.recordSuccess('t1', 100);
    tracker.recordFailure('t1', 'e', 'm', 100);
    expect(tracker.getRecord('t1')!.successRate).toBeCloseTo(2 / 3);
  });

  it('should compute MTBF', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordSuccess('t1', 100);
    tracker.recordSuccess('t1', 100);
    tracker.recordFailure('t1', 'e', 'm', 10);
    // MTBF = totalUptime / totalFailures = 200 / 1 = 200
    expect(tracker.getRecord('t1')!.mtbf).toBe(200);
  });

  it('should compute MTTR', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordFailure('t1', 'e', 'm', 10);
    tracker.recordRecovery('t1', 300);
    expect(tracker.getRecord('t1')!.mttr).toBe(300);
  });

  it('should get by type', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.getOrCreate('p1', 'provider');
    expect(tracker.getByType('tool')).toHaveLength(1);
    expect(tracker.getByType('provider')).toHaveLength(1);
  });

  it('should get most reliable', () => {
    tracker.getOrCreate('good', 'tool');
    tracker.recordSuccess('good', 100);
    tracker.getOrCreate('bad', 'tool');
    tracker.recordFailure('bad', 'e', 'm', 10);
    const most = tracker.getMostReliable(1);
    expect(most[0].componentId).toBe('good');
  });

  it('should get least reliable', () => {
    tracker.getOrCreate('good', 'tool');
    tracker.recordSuccess('good', 100);
    tracker.getOrCreate('bad', 'tool');
    tracker.recordFailure('bad', 'e', 'm', 10);
    const least = tracker.getLeastReliable(1);
    expect(least[0].componentId).toBe('bad');
  });

  it('should get currently failing', () => {
    tracker.getOrCreate('ok', 'tool');
    tracker.recordSuccess('ok', 100);
    tracker.getOrCreate('fail', 'tool');
    tracker.recordFailure('fail', 'e', 'm', 10);
    expect(tracker.getCurrentlyFailing()).toHaveLength(1);
  });

  it('should compute overall reliability', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordSuccess('t1', 100);
    tracker.getOrCreate('t2', 'tool');
    tracker.recordSuccess('t2', 100);
    tracker.recordFailure('t2', 'e', 'm', 100);
    expect(tracker.getOverallReliability()).toBeCloseTo(0.75, 1);
  });

  it('should get failure history', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.recordFailure('t1', 'e1', 'm1', 10);
    tracker.recordFailure('t1', 'e2', 'm2', 20);
    expect(tracker.getFailureHistory('t1')).toHaveLength(2);
  });

  it('should reset component', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.resetComponent('t1');
    expect(tracker.getRecord('t1')).toBeUndefined();
  });

  it('should reset all', () => {
    tracker.getOrCreate('t1', 'tool');
    tracker.reset();
    expect(tracker.getRecords()).toHaveLength(0);
  });
});
