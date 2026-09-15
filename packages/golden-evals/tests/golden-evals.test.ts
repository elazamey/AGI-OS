import { describe, it, expect, beforeEach } from 'vitest';
import type { MissionScenario } from '../src/index.js';
import { GoldenMissionEvaluator } from '../src/index.js';

describe('GoldenMissionEvaluator', () => {
  let evaluator: GoldenMissionEvaluator;

  beforeEach(() => {
    evaluator = new GoldenMissionEvaluator();
  });

  it('should create evaluator with default scenarios', () => {
    expect(evaluator).toBeDefined();
    expect(evaluator.getAllScenarios().length).toBe(4);
  });

  it('should get scenario by id', () => {
    const scenario = evaluator.getScenario('bug-fix-001');
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe('Fix Null Pointer Exception');
  });

  it('should get scenarios by difficulty', () => {
    const easy = evaluator.getScenariosByDifficulty('easy');
    const hard = evaluator.getScenariosByDifficulty('hard');
    expect(easy.length).toBe(1);
    expect(hard.length).toBe(1);
  });

  it('should get scenarios by category', () => {
    const bugFix = evaluator.getScenariosByCategory('bug_fix');
    const security = evaluator.getScenariosByCategory('security');
    expect(bugFix.length).toBe(1);
    expect(security.length).toBe(1);
  });

  it('should add custom scenario', () => {
    const custom: MissionScenario = {
      id: 'custom-001',
      name: 'Custom Mission',
      description: 'A custom test mission',
      difficulty: 'easy',
      category: 'feature',
      context: {
        repository: 'test',
        branch: 'main',
        files: ['test.ts'],
        test_command: 'npm test',
      },
      requirements: ['Test requirement'],
      success_criteria: ['Test criteria'],
      timeout_seconds: 100,
    };

    evaluator.addScenario(custom);
    expect(evaluator.getAllScenarios().length).toBe(5);
    expect(evaluator.getScenario('custom-001')).toBeDefined();
  });

  it('should evaluate successful mission', async () => {
    const scenario = evaluator.getScenario('bug-fix-001')!;
    const result = await evaluator.evaluateMission(scenario, async (ctx) => {
      return 'Bug fixed successfully';
    });

    expect(result.status).toBe('success');
    expect(result.autonomous).toBe(true);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('should evaluate failed mission', async () => {
    const scenario = evaluator.getScenario('bug-fix-001')!;
    const result = await evaluator.evaluateMission(scenario, async (ctx) => {
      throw new Error('Unable to fix bug');
    });

    expect(result.status).toBe('failure');
    expect(result.autonomous).toBe(false);
    expect(result.error).toBe('Unable to fix bug');
  });

  it('should calculate benchmark results', async () => {
    const scenario1 = evaluator.getScenario('bug-fix-001')!;
    const scenario2 = evaluator.getScenario('feature-001')!;

    await evaluator.evaluateMission(scenario1, async () => 'success');
    await evaluator.evaluateMission(scenario2, async () => { throw new Error('failed'); });

    const benchmark = evaluator.getBenchmarkResult();
    expect(benchmark.total_missions).toBe(2);
    expect(benchmark.successful).toBe(1);
    expect(benchmark.failed).toBe(1);
    expect(benchmark.autonomous_rate).toBe(0.5);
  });

  it('should group results by difficulty', async () => {
    const easy = evaluator.getScenario('bug-fix-001')!;
    const hard = evaluator.getScenario('security-001')!;

    await evaluator.evaluateMission(easy, async () => 'success');
    await evaluator.evaluateMission(hard, async () => { throw new Error('failed'); });

    const benchmark = evaluator.getBenchmarkResult();
    expect(benchmark.by_difficulty.easy).toBeDefined();
    expect(benchmark.by_difficulty.hard).toBeDefined();
    expect(benchmark.by_difficulty.easy.total).toBe(1);
    expect(benchmark.by_difficulty.hard.total).toBe(1);
  });

  it('should group results by category', async () => {
    const bugFix = evaluator.getScenario('bug-fix-001')!;
    const security = evaluator.getScenario('security-001')!;

    await evaluator.evaluateMission(bugFix, async () => 'success');
    await evaluator.evaluateMission(security, async () => 'success');

    const benchmark = evaluator.getBenchmarkResult();
    expect(benchmark.by_category.bug_fix.successful).toBe(1);
    expect(benchmark.by_category.security.successful).toBe(1);
  });

  it('should track duration', async () => {
    const scenario = evaluator.getScenario('bug-fix-001')!;
    const result = await evaluator.evaluateMission(scenario, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'success';
    });

    expect(result.duration_ms).toBeGreaterThanOrEqual(40);
  });

  it('should get results', async () => {
    const scenario = evaluator.getScenario('bug-fix-001')!;
    await evaluator.evaluateMission(scenario, async () => 'success');

    const results = evaluator.getResults();
    expect(results.length).toBe(1);
  });

  it('should clear results', async () => {
    const scenario = evaluator.getScenario('bug-fix-001')!;
    await evaluator.evaluateMission(scenario, async () => 'success');

    evaluator.clearResults();
    expect(evaluator.getResults().length).toBe(0);
  });

  it('should calculate average metrics', async () => {
    const scenario1 = evaluator.getScenario('bug-fix-001')!;
    const scenario2 = evaluator.getScenario('feature-001')!;

    await evaluator.evaluateMission(scenario1, async () => 'success');
    await evaluator.evaluateMission(scenario2, async () => 'success');

    const benchmark = evaluator.getBenchmarkResult();
    expect(benchmark.avg_duration_ms).toBeGreaterThanOrEqual(0);
    expect(benchmark.avg_tool_calls).toBeGreaterThanOrEqual(0);
  });
});
