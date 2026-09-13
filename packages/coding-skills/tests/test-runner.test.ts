import { describe, it, expect, beforeEach } from 'vitest';
import { TestRunner } from '../src/test-runner.js';

describe('TestRunner', () => {
  let runner: TestRunner;
  beforeEach(() => { runner = new TestRunner(); });

  it('runs passing tests', () => {
    const result = runner.runTest('test.ts', [{ name: 't1', passed: true }, { name: 't2', passed: true }]);
    expect(result.passed).toBe(true);
    expect(result.tests).toBe(2);
  });

  it('detects failures', () => {
    const result = runner.runTest('test.ts', [{ name: 't1', passed: true }, { name: 't2', passed: false, error: 'crash' }]);
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBe(1);
  });

  it('generates test stub', () => {
    const stub = runner.generateTestStub('./module', ['funcA', 'funcB']);
    expect(stub).toContain('funcA');
    expect(stub).toContain('describe');
  });

  it('gets overall stats', () => {
    runner.runTest('a.ts', [{ name: 't1', passed: true }]);
    runner.runTest('b.ts', [{ name: 't2', passed: false, error: 'e' }]);
    const stats = runner.getOverallStats();
    expect(stats.total).toBe(2);
    expect(stats.failed).toBe(1);
  });
});
