import { describe, it, expect, beforeEach } from 'vitest';
import { RegressionTracker } from '../src/regression-tracker.js';
import type { BenchmarkResult } from '../src/types.js';

describe('RegressionTracker', () => {
  let t: RegressionTracker;
  beforeEach(() => { t = new RegressionTracker(); });

  const result = (scenarioId: string, score: number, passed: boolean = score > 0.5): BenchmarkResult => ({
    id: `r-${Math.random()}`, suiteId: 's1', scenarioId, model: 'm1', provider: 'p1',
    actual: { outcome: passed ? 'success' : 'failure', duration: 100 },
    passed, score, duration: 100, timestamp: new Date().toISOString(),
  });

  it('records results', () => {
    t.recordResults('model1', [result('sc1', 1.0)]);
    expect(t.getResults('model1').length).toBe(1);
  });

  it('gets latest results', () => {
    const results = Array.from({ length: 5 }, (_, i) => result('sc1', i * 0.2));
    t.recordResults('model1', results);
    expect(t.getLatestResults('model1', 3).length).toBe(3);
  });

  it('generates report', () => {
    t.recordResults('m1', [result('sc1', 1.0), result('sc2', 0.0)]);
    const r = t.generateReport('m1');
    expect(r.totalScenarios).toBe(2);
    expect(r.passed).toBe(1);
    expect(r.failed).toBe(1);
  });

  it('detects regressions', () => {
    t.recordResults('m1', [result('sc1', 0.8)]);
    t.recordResults('m1', [result('sc1', 0.5)]);
    const regressions = t.detectRegressions('m1', -0.1);
    expect(regressions.length).toBe(1);
    expect(regressions[0].trend).toBe('regressing');
  });

  it('detects improvements', () => {
    t.recordResults('m1', [result('sc1', 0.5)]);
    t.recordResults('m1', [result('sc1', 0.9)]);
    const report = t.generateReport('m1');
    expect(report.improvements.length).toBe(1);
    expect(report.improvements[0].trend).toBe('improving');
  });

  it('no regression for stable', () => {
    t.recordResults('m1', [result('sc1', 0.8)]);
    t.recordResults('m1', [result('sc1', 0.8)]);
    expect(t.detectRegressions('m1').length).toBe(0);
  });

  it('clears', () => {
    t.recordResults('m1', [result('sc1', 1.0)]);
    t.clear();
    expect(t.getResults('m1').length).toBe(0);
  });
});
