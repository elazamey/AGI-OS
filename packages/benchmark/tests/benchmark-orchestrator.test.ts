import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkOrchestrator } from '../src/benchmark-orchestrator.js';
import { PolicyDecision } from '@agi-os/governance';

describe('BenchmarkOrchestrator', () => {
  let b: BenchmarkOrchestrator;
  beforeEach(() => { b = new BenchmarkOrchestrator(); });

  it('registers suite', () => {
    const s = b.registerSuite({ name: 'Test', description: 'D', scenarios: [], category: 'safety' });
    expect(s.id).toBeDefined();
    expect(b.getAllSuites().length).toBe(1);
  });

  it('gets suite by id', () => {
    const s = b.registerSuite({ name: 'Test', description: 'D', scenarios: [], category: 'safety' });
    expect(b.getSuite(s.id)).toBeDefined();
  });

  it('gets suites by category', () => {
    b.registerSuite({ name: 'S1', description: 'D', scenarios: [], category: 'safety' });
    b.registerSuite({ name: 'S2', description: 'D', scenarios: [], category: 'tool_use' });
    expect(b.getSuitesByCategory('safety').length).toBe(1);
  });

  it('runs scenario — pass', () => {
    const s = b.registerSuite({
      name: 'Test', description: 'D', category: 'safety',
      scenarios: [{ id: 'sc1', name: 'S', description: 'D', input: { goal: 'G', context: {}, availableTools: [] }, expected: { outcome: 'blocked', expectedGovernance: PolicyDecision.BLOCK }, timeout: 5000, tags: [] }],
    });
    const r = b.runScenario(s.id, 'sc1', { outcome: 'blocked', governanceDecision: PolicyDecision.BLOCK, duration: 10 }, 'model', 'provider');
    expect(r?.passed).toBe(true);
    expect(r?.score).toBeGreaterThan(0);
  });

  it('runs scenario — fail', () => {
    const s = b.registerSuite({
      name: 'Test', description: 'D', category: 'safety',
      scenarios: [{ id: 'sc1', name: 'S', description: 'D', input: { goal: 'G', context: {}, availableTools: [] }, expected: { outcome: 'blocked', expectedGovernance: PolicyDecision.BLOCK }, timeout: 5000, tags: [] }],
    });
    const r = b.runScenario(s.id, 'sc1', { outcome: 'success', governanceDecision: PolicyDecision.ALLOW, duration: 10 }, 'model', 'provider');
    expect(r?.passed).toBe(false);
  });

  it('returns undefined for invalid suite', () => {
    expect(b.runScenario('x', 'y', { outcome: 'success', duration: 0 }, 'm', 'p')).toBeUndefined();
  });

  it('returns undefined for invalid scenario', () => {
    const s = b.registerSuite({ name: 'T', description: 'D', scenarios: [], category: 'safety' });
    expect(b.runScenario(s.id, 'x', { outcome: 'success', duration: 0 }, 'm', 'p')).toBeUndefined();
  });

  it('gets results', () => {
    const s = b.registerSuite({
      name: 'T', description: 'D', category: 'safety',
      scenarios: [{ id: 'sc1', name: 'S', description: 'D', input: { goal: 'G', context: {}, availableTools: [] }, expected: { outcome: 'success' }, timeout: 5000, tags: [] }],
    });
    b.runScenario(s.id, 'sc1', { outcome: 'success', duration: 10 }, 'm', 'p');
    expect(b.getResults(s.id).length).toBe(1);
    expect(b.getAllResults().length).toBe(1);
  });

  it('calculates suite score', () => {
    const s = b.registerSuite({
      name: 'T', description: 'D', category: 'safety',
      scenarios: [{ id: 'sc1', name: 'S', description: 'D', input: { goal: 'G', context: {}, availableTools: [] }, expected: { outcome: 'success' }, timeout: 5000, tags: [] }],
    });
    b.runScenario(s.id, 'sc1', { outcome: 'success', duration: 10 }, 'm', 'p');
    expect(b.getSuiteScore(s.id)).toBeGreaterThan(0);
  });

  it('calculates overall score', () => {
    const s = b.registerSuite({
      name: 'T', description: 'D', category: 'safety',
      scenarios: [{ id: 'sc1', name: 'S', description: 'D', input: { goal: 'G', context: {}, availableTools: [] }, expected: { outcome: 'success' }, timeout: 5000, tags: [] }],
    });
    b.runScenario(s.id, 'sc1', { outcome: 'success', duration: 10 }, 'm', 'p');
    expect(b.getOverallScore()).toBeGreaterThan(0);
  });

  it('clears', () => {
    b.registerSuite({ name: 'T', description: 'D', scenarios: [], category: 'safety' });
    b.clear();
    expect(b.getAllSuites().length).toBe(0);
  });
});
