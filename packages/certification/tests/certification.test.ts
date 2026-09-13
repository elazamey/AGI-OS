import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceCollector } from '../src/evidence.js';
import { Scorecard } from '../src/scorecard.js';
import { CertificationRunner } from '../src/certification-runner.js';

describe('EvidenceCollector', () => {
  let collector: EvidenceCollector;
  beforeEach(() => { collector = new EvidenceCollector(); });

  it('collects evidence', () => {
    const ev = collector.collect({ testId: 'T-001', input: 'test', expected: 'pass', actual: 'pass', status: 'PASS', durationMs: 10 });
    expect(ev.evidenceHash).toBeDefined();
    expect(ev.testId).toBe('T-001');
  });

  it('generates unique hashes', () => {
    const e1 = collector.collect({ testId: 'T-001', input: null, expected: 'a', actual: 'a', status: 'PASS', durationMs: 1 });
    const e2 = collector.collect({ testId: 'T-002', input: null, expected: 'b', actual: 'b', status: 'FAIL', durationMs: 1 });
    expect(e1.evidenceHash).not.toBe(e2.evidenceHash);
  });

  it('filters by status', () => {
    collector.collect({ testId: 'a', input: null, expected: 'p', actual: 'p', status: 'PASS', durationMs: 1 });
    collector.collect({ testId: 'b', input: null, expected: 'f', actual: 'f', status: 'FAIL', durationMs: 1 });
    expect(collector.getByStatus('PASS').length).toBe(1);
    expect(collector.getByStatus('FAIL').length).toBe(1);
  });

  it('gets stats', () => {
    collector.collect({ testId: 'a', input: null, expected: 'p', actual: 'p', status: 'PASS', durationMs: 1 });
    const stats = collector.getStats();
    expect(stats.total).toBe(1);
  });
});

describe('Scorecard', () => {
  let scorecard: Scorecard;
  beforeEach(() => { scorecard = new Scorecard(); });

  it('records gate results', () => {
    scorecard.recordGate({ gate: 'G0', name: 'Foundation', total: 10, passed: 10, failed: 0, blocked: 0, skipped: 0, passRate: 1, status: 'PASS', durationMs: 100, evidence: [] });
    expect(scorecard.getGate('G0')).toBeDefined();
  });

  it('calculates overall score', () => {
    scorecard.recordGate({ gate: 'G0', name: 'Foundation', total: 10, passed: 9, failed: 1, blocked: 0, skipped: 0, passRate: 0.9, status: 'FAIL', durationMs: 100, evidence: [] });
    expect(scorecard.getOverallScore()).toBe(0.9);
  });

  it('detects critical failures', () => {
    scorecard.recordGate({ gate: 'G9', name: 'Security', total: 5, passed: 4, failed: 1, blocked: 0, skipped: 0, passRate: 0.8, status: 'FAIL', durationMs: 100, evidence: [{ testId: 'SEC-001', timestamp: '', gitSha: '', input: null, expected: 'BLOCK', actual: 'ALLOW', status: 'FAIL', durationMs: 0, logs: [], artifacts: [], evidenceHash: '' }] });
    expect(scorecard.hasCriticalFailures()).toBe(true);
  });

  it('gets summary', () => {
    scorecard.recordGate({ gate: 'G0', name: 'Foundation', total: 10, passed: 10, failed: 0, blocked: 0, skipped: 0, passRate: 1, status: 'PASS', durationMs: 100, evidence: [] });
    const summary = scorecard.getSummary();
    expect(summary.totalGates).toBe(1);
    expect(summary.passedGates).toBe(1);
  });
});

describe('CertificationRunner', () => {
  let runner: CertificationRunner;
  beforeEach(() => { runner = new CertificationRunner(); });

  it('creates instance', () => { expect(runner).toBeDefined(); });

  it('registers and runs gate', async () => {
    runner.registerGate('G0', async () => [
      { testId: 'FND-001', timestamp: '', gitSha: '', input: null, expected: 'PASS', actual: 'PASS', status: 'PASS', durationMs: 5, logs: [], artifacts: [], evidenceHash: 'abc' },
      { testId: 'FND-002', timestamp: '', gitSha: '', input: null, expected: 'PASS', actual: 'PASS', status: 'PASS', durationMs: 5, logs: [], artifacts: [], evidenceHash: 'def' },
    ]);
    const result = await runner.runGate('G0');
    expect(result.total).toBe(2);
    expect(result.passed).toBe(2);
    expect(result.status).toBe('PASS');
  });

  it('runs full certification', async () => {
    runner.registerGate('G0', async () => [
      { testId: 'FND-001', timestamp: '', gitSha: '', input: null, expected: 'PASS', actual: 'PASS', status: 'PASS', durationMs: 1, logs: [], artifacts: [], evidenceHash: 'a' },
    ]);
    const report = await runner.runAll();
    expect(report.totalTests).toBeGreaterThanOrEqual(1);
    expect(report.releaseDecision).toBeDefined();
  });
});
