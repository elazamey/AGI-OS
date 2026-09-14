import { describe, it, expect } from 'vitest';
import { PreflightEvaluator } from './preflight-evaluator.js';
import { SwarmAgent } from './swarm-agent.js';
import { EventChannel } from '../event-channel.js';
import type { BrainAdapter, SwarmTask } from './swarm-agent.js';

function createBrain(): BrainAdapter {
  return { process: async () => 'ok' };
}

function createAgent(id: string, role: 'researcher' | 'coder' | 'auditor'): SwarmAgent {
  return new SwarmAgent(id, role, `Agent ${id}`, createBrain(), new EventChannel());
}

function createTask(overrides?: Partial<SwarmTask>): SwarmTask {
  return {
    id: `task-${Date.now()}`,
    goal: 'build a feature',
    description: 'build a feature',
    ...overrides,
  };
}

describe('PreflightEvaluator', () => {
  it('passes when agent exists and capabilities match', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'build a feature' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.passed).toBe(true);
    expect(result.riskScore).toBeLessThanOrEqual(0.7);
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('fails when agent does not exist', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const task = createTask();

    const result = evaluator.evaluate(task, [agent], 'nonexistent');

    expect(result.passed).toBe(false);
    expect(result.blockingReason).toContain('agent_exists');
    expect(result.checks.find(c => c.name === 'agent_exists')!.passed).toBe(false);
  });

  it('flags capability mismatch for researcher task assigned to coder', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'research the market' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'capability_match')!.passed).toBe(false);
  });

  it('passes capability check for matching role', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'researcher');
    const task = createTask({ goal: 'research the market' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'capability_match')!.passed).toBe(true);
  });

  it('detects resource conflicts when multiple agents target same resource', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');

    // Record conflicting action
    evaluator.recordAction('a2', 'shared-file.ts', 'write');

    const task = createTask({ goal: 'shared-file.ts' });
    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'no_resource_conflicts')!.passed).toBe(false);
  });

  it('passes when no resource conflicts exist', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'unique-feature.ts' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'no_resource_conflicts')!.passed).toBe(true);
  });

  it('assesses complexity and flags high-risk tasks', () => {
    const evaluator = new PreflightEvaluator({ maxRiskScore: 0.3 });
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'deploy critical security fix to production database' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    const complexityCheck = result.checks.find(c => c.name === 'complexity_assessment');
    expect(complexityCheck!.passed).toBe(false);
  });

  it('allows simple tasks within risk threshold', () => {
    const evaluator = new PreflightEvaluator({ maxRiskScore: 0.8 });
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'fix typo' });

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'complexity_assessment')!.passed).toBe(true);
  });

  it('flags concurrent safety when agent has too many pending actions', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');

    // Add 3 pending actions for agent a1
    evaluator.recordAction('a1', 'file1.ts', 'write');
    evaluator.recordAction('a1', 'file2.ts', 'write');
    evaluator.recordAction('a1', 'file3.ts', 'write');

    const task = createTask();
    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'concurrent_safety')!.passed).toBe(false);
  });

  it('passes concurrent safety with few pending actions', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');

    evaluator.recordAction('a1', 'file1.ts', 'write');

    const task = createTask();
    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.find(c => c.name === 'concurrent_safety')!.passed).toBe(true);
  });

  it('accumulates risk score from multiple failures', () => {
    const evaluator = new PreflightEvaluator();
    const task = createTask({ goal: 'deploy critical production database security fix' });

    // Non-existent agent + capability mismatch + complexity
    const result = evaluator.evaluate(task, [], 'ghost');

    expect(result.riskScore).toBeGreaterThan(0.5);
    expect(result.passed).toBe(false);
  });

  it('clears action history', () => {
    const evaluator = new PreflightEvaluator();
    evaluator.recordAction('a1', 'file.ts', 'write');
    expect(evaluator.getRecentActions()).toHaveLength(1);

    evaluator.clearActions();
    expect(evaluator.getRecentActions()).toHaveLength(0);
  });

  it('returns all check details', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const task = createTask();

    const result = evaluator.evaluate(task, [agent], 'a1');

    expect(result.checks.length).toBeGreaterThanOrEqual(4);
    expect(result.checks.every(c => typeof c.name === 'string')).toBe(true);
    expect(result.checks.every(c => typeof c.passed === 'boolean')).toBe(true);
    expect(result.checks.every(c => typeof c.details === 'string')).toBe(true);
  });

  it('custom agent role matches any task', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('flex', 'custom');
    const task = createTask({ goal: 'do anything' });

    const result = evaluator.evaluate(task, [agent], 'flex');

    expect(result.checks.find(c => c.name === 'capability_match')!.passed).toBe(true);
  });

  it('respects custom maxRiskScore threshold', () => {
    const strict = new PreflightEvaluator({ maxRiskScore: 0.1 });
    const relaxed = new PreflightEvaluator({ maxRiskScore: 0.9 });
    const agent = createAgent('a1', 'coder');
    const task = createTask({ goal: 'build simple feature' });

    const strictResult = strict.evaluate(task, [agent], 'a1');
    const relaxedResult = relaxed.evaluate(task, [agent], 'a1');

    expect(strictResult.passed).toBe(true);
    expect(relaxedResult.passed).toBe(true);
  });

  it('handles DecomposedTask format', () => {
    const evaluator = new PreflightEvaluator();
    const agent = createAgent('a1', 'coder');
    const decomposedTask = {
      id: 'dt-1',
      goal: 'build the feature',
      requiredRole: 'coder' as const,
      requiredCapabilities: ['coding'],
      priority: 'high' as const,
      order: 1,
    };

    const result = evaluator.evaluate(decomposedTask, [agent], 'a1');

    expect(result.passed).toBe(true);
  });
});
