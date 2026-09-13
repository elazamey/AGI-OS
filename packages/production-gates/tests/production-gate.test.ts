import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionGate } from '../src/production-gate.js';
import { SBOMGenerator } from '../src/sbom-generator.js';
import { DependencyAuditor } from '../src/dependency-auditor.js';
import { RegressionTracker } from '../src/regression-tracker.js';

describe('ProductionGate', () => {
  let gate: ProductionGate;

  beforeEach(() => {
    gate = new ProductionGate();
  });

  it('creates instance', () => {
    expect(gate).toBeDefined();
  });

  it('runs all gates with PASS', () => {
    gate.getSBOM().addEntry({ name: 'test', version: '1.0.0', license: 'MIT', depth: 0 });
    const report = gate.runAllGates('1.5.0', { 'test-dep': '1.0.0' }, { testMetric: 100 });
    expect(report.overallStatus).toBe('PASS');
    expect(report.gates.length).toBe(5);
    expect(report.version).toBe('1.5.0');
  });

  it('SBOM gate warns when empty', () => {
    const result = gate.runSBOMGate();
    expect(result.status).toBe('WARN');
  });

  it('SBOM gate passes when entries exist', () => {
    gate.getSBOM().addEntry({ name: 'test', version: '1.0.0', license: 'MIT', depth: 0 });
    const result = gate.runSBOMGate();
    expect(result.status).toBe('PASS');
  });

  it('dependency gate detects critical vulns', () => {
    const result = gate.runDependencyGate({ 'next': '14.2.0' });
    expect(result.status).toBe('FAIL');
  });

  it('dependency gate passes with safe deps', () => {
    const result = gate.runDependencyGate({ 'safe-pkg': '1.0.0' });
    expect(result.status).toBe('PASS');
  });

  it('regression gate tracks baselines', () => {
    gate.getRegression().setBaseline('testTime', 100, 0.2, 'ms');
    const result = gate.runRegressionGate({ testTime: 110 });
    expect(result.status).toBe('PASS');
  });

  it('regression gate detects regressions', () => {
    gate.getRegression().setBaseline('testTime', 100, 0.1, 'ms');
    const result = gate.runRegressionGate({ testTime: 150 });
    expect(result.status).toBe('FAIL');
  });

  it('governance gate passes', () => {
    const result = gate.runGovernanceGate();
    expect(result.status).toBe('PASS');
  });

  it('policy gate passes', () => {
    const result = gate.runPolicyGate();
    expect(result.status).toBe('PASS');
  });
});

describe('SBOMGenerator', () => {
  let sbom: SBOMGenerator;
  beforeEach(() => { sbom = new SBOMGenerator(); });

  it('scans package dependencies', () => {
    const entries = sbom.scanPackage({ name: 'test', version: '1.0.0', dependencies: { 'dep1': '^1.0.0', 'dep2': '^2.0.0' } });
    expect(entries.length).toBe(2);
  });

  it('tracks stats', () => {
    sbom.addEntry({ name: 'a', version: '1', license: 'MIT', depth: 0 });
    sbom.addEntry({ name: 'b', version: '2', license: 'Apache-2.0', depth: 1 });
    const stats = sbom.getStats();
    expect(stats.total).toBe(2);
  });

  it('deduplicates', () => {
    sbom.addEntry({ name: 'a', version: '1', license: 'MIT', depth: 0 });
    sbom.addEntry({ name: 'a', version: '1', license: 'MIT', depth: 0 });
    expect(sbom.getEntries().length).toBe(1);
  });
});

describe('DependencyAuditor', () => {
  let auditor: DependencyAuditor;
  beforeEach(() => { auditor = new DependencyAuditor(); });

  it('detects known vulnerabilities', () => {
    const results = auditor.audit({ 'next': '14.2.0' });
    expect(results.length).toBe(1);
    expect(results[0].severity).toBe('critical');
  });

  it('passes safe dependencies', () => {
    const results = auditor.audit({ 'safe-pkg': '1.0.0' });
    expect(results.length).toBe(0);
  });

  it('registers custom vulnerabilities', () => {
    auditor.registerVulnerability('custom@1.0.0', { severity: 'critical', advisory: 'Test vuln' });
    const results = auditor.audit({ 'custom': '1.0.0' });
    expect(results.length).toBe(1);
    expect(results[0].severity).toBe('critical');
  });

  it('counts critical and high', () => {
    auditor.registerVulnerability('a@1', { severity: 'critical', advisory: '' });
    auditor.registerVulnerability('b@1', { severity: 'high', advisory: '' });
    const results = auditor.audit({ 'a': '1', 'b': '1' });
    expect(auditor.getCriticalCount(results)).toBe(1);
    expect(auditor.getHighCount(results)).toBe(1);
  });

  it('checks blocking vulnerabilities', () => {
    auditor.registerVulnerability('a@1', { severity: 'critical', advisory: '' });
    const results = auditor.audit({ 'a': '1' });
    expect(auditor.hasBlockingVulnerabilities(results)).toBe(true);
  });
});

describe('RegressionTracker', () => {
  let tracker: RegressionTracker;
  beforeEach(() => { tracker = new RegressionTracker(); });

  it('sets and gets baselines', () => {
    tracker.setBaseline('testTime', 100, 0.2, 'ms');
    const baseline = tracker.getBaseline('testTime');
    expect(baseline).toBeDefined();
    expect(baseline!.baseline).toBe(100);
  });

  it('passes check within threshold', () => {
    tracker.setBaseline('testTime', 100, 0.2, 'ms');
    const check = tracker.check('testTime', 110);
    expect(check.passed).toBe(true);
  });

  it('fails check outside threshold', () => {
    tracker.setBaseline('testTime', 100, 0.1, 'ms');
    const check = tracker.check('testTime', 150);
    expect(check.passed).toBe(false);
    expect(check.deviation).toBe(0.5);
  });

  it('tracks history', () => {
    tracker.setBaseline('metric', 50, 0.1, 'count');
    tracker.checkAll({ metric: 55 });
    expect(tracker.getHistory().length).toBe(1);
  });
});
