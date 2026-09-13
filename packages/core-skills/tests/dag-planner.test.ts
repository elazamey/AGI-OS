import { describe, it, expect } from 'vitest';
import { DAGPlanner } from '../src/dag-planner.js';
import type { DecomposedTask } from '../src/types.js';

describe('DAGPlanner', () => {
  const planner = new DAGPlanner();

  it('creates plan from task', () => {
    const task: DecomposedTask = {
      id: 't1', parentGoalId: 'g1',
      steps: [{ id: 's1', skillId: 'intent', description: 'Analyze', input: {}, dependencies: [], status: 'pending' }],
      parallelGroups: [], criticalPath: ['s1'],
    };
    const plan = planner.createPlan(task);
    expect(plan.steps.length).toBe(1);
    expect(plan.id).toBeDefined();
  });

  it('gets ready steps', () => {
    const task: DecomposedTask = {
      id: 't1', parentGoalId: 'g1',
      steps: [
        { id: 's1', skillId: 'a', description: 'A', input: {}, dependencies: [], status: 'pending' },
        { id: 's2', skillId: 'b', description: 'B', input: {}, dependencies: ['s1'], status: 'pending' },
      ],
      parallelGroups: [], criticalPath: [],
    };
    const plan = planner.createPlan(task);
    const ready = planner.getReadySteps(plan, new Set());
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe('s1');
  });

  it('marks step completed', () => {
    const task: DecomposedTask = {
      id: 't1', parentGoalId: 'g1',
      steps: [{ id: 's1', skillId: 'a', description: 'A', input: {}, dependencies: [], status: 'pending' }],
      parallelGroups: [], criticalPath: [],
    };
    const plan = planner.createPlan(task);
    planner.markStepCompleted(plan, 's1', { done: true });
    expect(plan.steps[0].status).toBe('completed');
  });

  it('gets progress', () => {
    const task: DecomposedTask = {
      id: 't1', parentGoalId: 'g1',
      steps: [
        { id: 's1', skillId: 'a', description: 'A', input: {}, dependencies: [], status: 'completed' },
        { id: 's2', skillId: 'b', description: 'B', input: {}, dependencies: [], status: 'pending' },
      ],
      parallelGroups: [], criticalPath: [],
    };
    const plan = planner.createPlan(task);
    const progress = planner.getProgress(plan);
    expect(progress.percentage).toBe(50);
  });
});
