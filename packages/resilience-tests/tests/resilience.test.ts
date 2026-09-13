import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayTester } from '../src/replay-tester.js';
import { CrashRecoveryTester } from '../src/crash-recovery.js';
import { RaceConditionTester } from '../src/race-condition-tester.js';

describe('ReplayTester', () => {
  let tester: ReplayTester;
  beforeEach(() => { tester = new ReplayTester(); });

  it('records and replays deterministically', () => {
    tester.record('test1', 5, (x) => (x as number) * 2);
    const result = tester.replay('test1');
    expect(result).not.toBeNull();
    expect(result!.match).toBe(true);
    expect(result!.deterministic).toBe(true);
  });

  it('detects non-determinism', () => {
    let counter = 0;
    tester.record('test2', null, () => counter++);
    const result = tester.replay('test2');
    expect(result!.match).toBe(false);
  });

  it('replays all recordings', () => {
    tester.record('a', 1, (x) => x);
    tester.record('b', 2, (x) => x);
    const results = tester.replayAll();
    expect(results.length).toBe(2);
  });

  it('calculates determinism rate', () => {
    tester.record('det', 1, (x) => x);
    tester.record('det2', 2, (x) => x);
    expect(tester.getDeterminismRate()).toBe(1);
  });

  it('returns null for unknown id', () => {
    expect(tester.replay('unknown')).toBeNull();
  });
});

describe('CrashRecoveryTester', () => {
  let tester: CrashRecoveryTester;
  beforeEach(() => { tester = new CrashRecoveryTester(); });

  it('has default scenarios', () => {
    expect(tester.getScenarios().length).toBe(5);
  });

  it('runs all scenarios', () => {
    const results = tester.runAll();
    expect(results.length).toBe(5);
    expect(results.every(r => r.recovered)).toBe(true);
  });

  it('calculates recovery rate', () => {
    expect(tester.getRecoveryRate()).toBe(1);
  });

  it('adds custom scenario', () => {
    tester.addScenario({ id: 'custom', name: 'Custom', description: 'Test', type: 'oom', trigger: () => {}, recovery: async () => true });
    expect(tester.getScenarios().length).toBe(6);
  });
});

describe('RaceConditionTester', () => {
  let tester: RaceConditionTester;
  beforeEach(() => { tester = new RaceConditionTester(); });

  it('has default races', () => {
    expect(tester.getRaces().length).toBe(4);
  });

  it('runs all races', async () => {
    const results = await tester.runAll();
    expect(results.length).toBe(4);
  });

  it('calculates pass rate', async () => {
    const rate = await tester.getPassRate();
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it('adds custom race', () => {
    tester.addRace({ id: 'custom', name: 'Custom', description: 'Test', operations: [async () => 'a'], expectedBehavior: 'last-write-wins' });
    expect(tester.getRaces().length).toBe(5);
  });
});
