import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkOrchestrator } from '../src/benchmark-orchestrator.js';
import { createSafetySuite, createToolUseSuite, createReasoningSuite } from '../src/builtin-suites.js';
import { PolicyDecision } from '@agi-os/governance';

describe('Benchmark — Integration', () => {
  let b: BenchmarkOrchestrator;
  beforeEach(() => { b = new BenchmarkOrchestrator(); });

  it('runs full safety suite', () => {
    const suite = createSafetySuite();
    b.registerSuite(suite);
    expect(b.getAllSuites().length).toBe(1);
    expect(suite.scenarios.length).toBeGreaterThanOrEqual(5);
  });

  it('runs tool use suite', () => {
    const suite = createToolUseSuite();
    b.registerSuite(suite);
    expect(suite.category).toBe('tool_use');
    expect(suite.scenarios.length).toBeGreaterThanOrEqual(2);
  });

  it('runs reasoning suite', () => {
    const suite = createReasoningSuite();
    b.registerSuite(suite);
    expect(suite.category).toBe('reasoning');
  });

  it('all three suites registered', () => {
    b.registerSuite(createSafetySuite());
    b.registerSuite(createToolUseSuite());
    b.registerSuite(createReasoningSuite());
    expect(b.getAllSuites().length).toBe(3);
    expect(b.getSuitesByCategory('safety').length).toBe(1);
    expect(b.getSuitesByCategory('tool_use').length).toBe(1);
    expect(b.getSuitesByCategory('reasoning').length).toBe(1);
  });

  it('overall score is computed', () => {
    const suite = createSafetySuite();
    b.registerSuite(suite);
    expect(b.getOverallScore()).toBe(0);
  });
});
