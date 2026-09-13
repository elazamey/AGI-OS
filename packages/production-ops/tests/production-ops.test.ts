import { describe, it, expect } from 'vitest';
import {
  ChaosEngine,
  CanaryRunner,
  DriftDetector,
  SupplyChainAuditor,
  DisasterRecoveryTester,
  ColdRestartTester,
  MigrationTester,
} from '../src/index.js';

describe('ChaosEngine', () => {
  it('should create with zero failures', () => {
    const engine = new ChaosEngine();
    expect(engine.getFailureCount()).toBe(0);
  });

  it('should inject tool failures', () => {
    const engine = new ChaosEngine();
    engine.injectToolFailures([{ tool: 'read', error: 'timeout' }]);
    expect(engine.getFailureCount()).toBe(1);
  });

  it('should inject network failures', () => {
    const engine = new ChaosEngine();
    engine.injectNetworkFailures([{ url: 'http://api.test', timeout: false }]);
    expect(engine.getFailureCount()).toBe(1);
  });

  it('should run mission with no failures', () => {
    const engine = new ChaosEngine();
    const result = engine.runMission(['step1', 'step2']);
    expect(result.recovered).toBe(true);
    expect(result.dataLoss).toBe(false);
    expect(result.injected).toBe('none');
  });

  it('should run mission with tool failures and recover', () => {
    const engine = new ChaosEngine();
    engine.injectToolFailures([{ tool: 'step1', error: 'ECONNRESET' }]);
    const result = engine.runMission(['step1', 'step2']);
    expect(result.recovered).toBe(true);
    expect(result.duplicateActions).toBe(1);
  });

  it('should run mission with network timeout and lose data', () => {
    const engine = new ChaosEngine();
    engine.injectNetworkFailures([{ url: 'step1', timeout: true }]);
    const result = engine.runMission(['step1', 'step2']);
    expect(result.recovered).toBe(false);
    expect(result.dataLoss).toBe(true);
  });

  it('should clear all failures', () => {
    const engine = new ChaosEngine();
    engine.injectToolFailures([{ tool: 't', error: 'e' }]);
    engine.injectNetworkFailures([{ url: 'u', timeout: false }]);
    engine.clear();
    expect(engine.getFailureCount()).toBe(0);
  });

  it('should accumulate failure counts', () => {
    const engine = new ChaosEngine();
    engine.injectToolFailures([{ tool: 'a', error: '1' }, { tool: 'b', error: '2' }]);
    engine.injectNetworkFailures([{ url: 'x', timeout: false }]);
    expect(engine.getFailureCount()).toBe(3);
  });
});

describe('CanaryRunner', () => {
  it('should register and run mission', () => {
    const runner = new CanaryRunner();
    runner.registerMission('m1', { steps: ['a', 'b'], timeout: 5000 });
    const result = runner.runMission('m1');
    expect(result.missionId).toBe('m1');
    expect(result.success).toBe(true);
  });

  it('should throw for unregistered mission', () => {
    const runner = new CanaryRunner();
    expect(() => runner.runMission('nope')).toThrow('Mission nope not registered');
  });

  it('should track success rate', () => {
    const runner = new CanaryRunner();
    runner.registerMission('m1', { steps: [], timeout: 1 });
    runner.runMission('m1');
    runner.runMission('m1');
    expect(runner.getSuccessRate()).toBeGreaterThanOrEqual(0);
    expect(runner.getSuccessRate()).toBeLessThanOrEqual(1);
  });

  it('should return results copy', () => {
    const runner = new CanaryRunner();
    runner.registerMission('m1', { steps: [], timeout: 5000 });
    runner.runMission('m1');
    const results = runner.getResults();
    expect(results).toHaveLength(1);
    results.pop();
    expect(runner.getResults()).toHaveLength(1);
  });

  it('should have timestamp on results', () => {
    const runner = new CanaryRunner();
    runner.registerMission('m1', { steps: [], timeout: 5000 });
    const result = runner.runMission('m1');
    expect(result.timestamp).toBeTruthy();
  });

  it('should return 1 for success rate with no results', () => {
    const runner = new CanaryRunner();
    expect(runner.getSuccessRate()).toBe(1);
  });
});

describe('DriftDetector', () => {
  it('should set baseline and detect no drift', () => {
    const detector = new DriftDetector();
    detector.setBaseline('latency', 100);
    detector.recordCurrent('latency', 105);
    const results = detector.detectDrift(10);
    expect(results[0].drifted).toBe(false);
  });

  it('should detect drift when threshold exceeded', () => {
    const detector = new DriftDetector();
    detector.setBaseline('latency', 100);
    detector.recordCurrent('latency', 200);
    const results = detector.detectDrift(10);
    expect(results[0].drifted).toBe(true);
    expect(results[0].severity).toBe('critical');
  });

  it('should report healthy when no drift', () => {
    const detector = new DriftDetector();
    detector.setBaseline('metric', 50);
    detector.recordCurrent('metric', 50);
    expect(detector.isHealthy()).toBe(true);
  });

  it('should report unhealthy when drift exists', () => {
    const detector = new DriftDetector();
    detector.setBaseline('metric', 100);
    detector.recordCurrent('metric', 200);
    expect(detector.isHealthy()).toBe(false);
  });

  it('should assign medium severity', () => {
    const detector = new DriftDetector();
    detector.setBaseline('metric', 100);
    detector.recordCurrent('metric', 115);
    const results = detector.detectDrift(10);
    expect(results[0].severity).toBe('medium');
  });

  it('should assign low severity', () => {
    const detector = new DriftDetector();
    detector.setBaseline('metric', 1000);
    detector.recordCurrent('metric', 1011);
    const results = detector.detectDrift(10);
    expect(results[0].severity).toBe('low');
  });
});

describe('SupplyChainAuditor', () => {
  it('should audit safe dependencies', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('lodash', '4.17.21');
    const results = auditor.audit();
    expect(results[0].safe).toBe(true);
    expect(results[0].vulnerability).toBeNull();
  });

  it('should detect vulnerabilities', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('pkg', '1.0.0', ['CVE-2024-0001']);
    const results = auditor.audit();
    expect(results[0].vulnerability).toBe('CVE-2024-0001');
    expect(results[0].safe).toBe(false);
  });

  it('should count vulnerabilities', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('a', '1.0.0', ['v1', 'v2']);
    auditor.addDependency('b', '2.0.0', ['v3']);
    expect(auditor.getVulnerabilityCount()).toBe(3);
  });

  it('should report safe with no vulns', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('safe-pkg', '1.0.0');
    expect(auditor.isSafe()).toBe(true);
  });

  it('should report unsafe with vulns', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('bad-pkg', '1.0.0', ['CVE-1']);
    expect(auditor.isSafe()).toBe(false);
  });

  it('should detect license issues', () => {
    const auditor = new SupplyChainAuditor();
    auditor.addDependency('gpl-pkg', 'GPL-3.0');
    const results = auditor.audit();
    expect(results[0].licenseIssue).toBe(true);
  });
});

describe('DisasterRecoveryTester', () => {
  it('should simulate crash and recover', () => {
    const dr = new DisasterRecoveryTester();
    dr.simulateCrash({ key: 'value' });
    const result = dr.recover();
    expect(result.recovered).toBe(true);
    expect(result.stateLost).toBe(false);
    expect(result.dataIntegrity).toBe(true);
  });

  it('should fail recovery without crash', () => {
    const dr = new DisasterRecoveryTester();
    const result = dr.recover();
    expect(result.recovered).toBe(false);
    expect(result.stateLost).toBe(true);
  });

  it('should measure RTO', () => {
    const dr = new DisasterRecoveryTester();
    dr.simulateCrash({ a: 1 });
    dr.recover();
    expect(dr.measureRTO()).toBeGreaterThanOrEqual(0);
  });

  it('should measure RPO as zero', () => {
    const dr = new DisasterRecoveryTester();
    dr.simulateCrash({ a: 1 });
    expect(dr.measureRPO()).toBe(0);
  });
});

describe('ColdRestartTester', () => {
  it('should save state and restart', () => {
    const tester = new ColdRestartTester();
    tester.saveState({ config: 'loaded' });
    const result = tester.restartFromScratch();
    expect(result.startedFromScratch).toBe(true);
    expect(result.stateRecovered).toBe(true);
    expect(result.missionsResumed).toBe(true);
  });

  it('should verify artifacts', () => {
    const tester = new ColdRestartTester();
    tester.saveState({ a: 1, b: 2 });
    expect(tester.verifyArtifacts()).toBe(true);
  });

  it('should have no artifacts initially', () => {
    const tester = new ColdRestartTester();
    expect(tester.verifyArtifacts()).toBe(false);
  });
});

describe('MigrationTester', () => {
  it('should add version and migrate', () => {
    const mt = new MigrationTester();
    mt.addVersion('v1', { id: 'int' });
    mt.addVersion('v2', { id: 'int', name: 'text' });
    const result = mt.migrate('v1', 'v2');
    expect(result.migrated).toBe(true);
    expect(result.schemaVersion).toBe('v2');
  });

  it('should fail migration with missing version', () => {
    const mt = new MigrationTester();
    const result = mt.migrate('v0', 'v1');
    expect(result.migrated).toBe(false);
  });

  it('should rollback', () => {
    const mt = new MigrationTester();
    mt.addVersion('v1', { id: 'int' });
    mt.addVersion('v2', { id: 'int', name: 'text' });
    mt.migrate('v1', 'v2');
    const result = mt.rollback('v2', 'v1');
    expect(result.migrated).toBe(true);
    expect(result.schemaVersion).toBe('v1');
  });

  it('should rerun migration', () => {
    const mt = new MigrationTester();
    mt.addVersion('v1', { id: 'int' });
    mt.addVersion('v2', { id: 'int', name: 'text' });
    const result = mt.rerunMigration('v1', 'v2');
    expect(result.migrated).toBe(true);
  });

  it('should report rollback possible on success', () => {
    const mt = new MigrationTester();
    mt.addVersion('v1', {});
    mt.addVersion('v2', {});
    const result = mt.migrate('v1', 'v2');
    expect(result.rollbackPossible).toBe(true);
  });

  it('should preserve data integrity on migrate', () => {
    const mt = new MigrationTester();
    mt.addVersion('v1', { col: 'text' });
    mt.addVersion('v2', { col: 'text', col2: 'int' });
    const result = mt.migrate('v1', 'v2');
    expect(result.dataIntact).toBe(true);
  });
});
