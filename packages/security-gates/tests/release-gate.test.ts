import { describe, it, expect, beforeEach } from 'vitest';
import { ReleaseGate } from '../src/release-gate.js';

describe('ReleaseGate — Full Audit', () => {
  let rg: ReleaseGate;
  beforeEach(() => { rg = new ReleaseGate(); });

  it('runs all gates', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.version).toBe('1.3.0');
    expect(report.gates.length).toBeGreaterThanOrEqual(2);
    expect(report.totalTests).toBeGreaterThan(0);
  });

  it('overall status is PASS when all gates pass', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.overallStatus).toBe('PASS');
  });

  it('reports total passed and failed', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.totalPassed).toBeGreaterThan(0);
    expect(report.totalFailed).toBe(0);
  });

  it('includes G1 sandbox escape gate', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.gates.some(g => g.gate === 'G1-SandboxEscape')).toBe(true);
  });

  it('includes G3 cost enforcement gate', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.gates.some(g => g.gate === 'G3-CostEnforcement')).toBe(true);
  });

  it('includes G7 red team gate', () => {
    const report = rg.runAllGates('1.3.0');
    expect(report.gates.some(g => g.gate === 'G7-RedTeam')).toBe(true);
  });

  it('evidence chain is accessible', () => {
    expect(rg.getEvidenceChain()).toBeDefined();
  });

  it('governance is accessible', () => {
    expect(rg.getGovernance()).toBeDefined();
  });
});
