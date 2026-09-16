import { describe, it, expect, beforeEach } from 'vitest';
import { MCTSPlanner } from '../src/index.js';

describe('MCTSPlanner', () => {
  let planner: MCTSPlanner;

  beforeEach(() => {
    planner = new MCTSPlanner(
      'start',
      (state) => state === 'goal' ? 1 : 0,
      (state) => state === 'goal' ? [] : ['left', 'right', 'forward'],
      (state, action) => {
        if (action === 'forward') return 'goal';
        return state + '-' + action;
      },
      { maxIterations: 50, maxDepth: 5 },
    );
  });

  it('should create planner', () => {
    expect(planner).toBeDefined();
    expect(planner.getRoot().state).toBe('start');
  });

  it('should run MCTS and find best action', () => {
    const result = planner.run();
    expect(result.bestAction).toBeDefined();
    expect(result.iterations).toBe(50);
    expect(result.treeSize).toBeGreaterThan(1);
  });

  it('should have positive confidence', () => {
    const result = planner.run();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should generate simulation results', () => {
    const result = planner.run();
    expect(result.simulationResults.length).toBeGreaterThan(0);
    result.simulationResults.forEach(r => {
      expect(r.action).toBeDefined();
      expect(r.score).toBeGreaterThanOrEqual(0);
    });
  });

  it('should explore different branches', () => {
    const result = planner.run();
    expect(result.treeSize).toBeGreaterThan(3);
  });

  it('should respect maxIterations', () => {
    const smallPlanner = new MCTSPlanner(
      'start',
      () => 0.5,
      () => ['a', 'b'],
      (s, a) => s + a,
      { maxIterations: 10 },
    );
    const result = smallPlanner.run();
    expect(result.iterations).toBe(10);
  });

  it('should handle terminal states', () => {
    const terminalPlanner = new MCTSPlanner(
      'goal',
      (s) => s === 'goal' ? 1 : 0,
      () => [],
      (s, a) => s,
      { maxIterations: 10 },
    );
    const result = terminalPlanner.run();
    expect(result.bestAction).toBe('');
  });

  it('should return config', () => {
    const config = planner.getConfig();
    expect(config.maxIterations).toBe(50);
    expect(config.explorationConstant).toBe(Math.SQRT2);
  });

  it('should prefer winning paths with higher iterations', () => {
    const highIterPlanner = new MCTSPlanner(
      'start',
      (s) => s.includes('forward') ? 1 : 0,
      (s) => s === 'start-forward' ? [] : ['left', 'right', 'forward'],
      (s, a) => a === 'forward' ? s + '-forward' : s + '-' + a,
      { maxIterations: 200 },
    );
    const result = highIterPlanner.run();
    expect(result.simulationResults.some(r => r.score > 0)).toBe(true);
  });

  it('should build tree with correct depths', () => {
    planner.run();
    const root = planner.getRoot();
    expect(root.depth).toBe(0);
    root.children.forEach(child => {
      expect(child.depth).toBe(1);
      expect(child.parent).toBe(root);
    });
  });
});
