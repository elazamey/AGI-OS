import { describe, it, expect } from 'vitest';
import { Replanner } from '../src/replanner.js';
import type { TaskPlan } from '../src/types.js';

describe('Replanner', () => {
  const replanner = new Replanner();

  it('replans after failure', () => {
    const plan: TaskPlan = {
      id: 'p1', goalId: 'g1', steps: [
        { id: 's1', skillId: 'a', description: 'A', input: {}, dependencies: [], status: 'completed' },
        { id: 's2', skillId: 'b', description: 'B', input: {}, dependencies: ['s1'], status: 'failed', error: 'crashed' },
      ],
      dependencies: new Map(), estimatedDuration: 1000, riskLevel: 'LOW',
    };
    const result = replanner.replan(plan, 's2', 'crashed');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(plan.steps.some(s => s.skillId === 'retry')).toBe(true);
  });

  it('decides when to replan', () => {
    const plan: TaskPlan = {
      id: 'p1', goalId: 'g1', steps: [
        { id: 's1', skillId: 'a', description: 'A', input: {}, dependencies: [], status: 'failed' },
        { id: 's2', skillId: 'b', description: 'B', input: {}, dependencies: [], status: 'failed' },
      ],
      dependencies: new Map(), estimatedDuration: 1000, riskLevel: 'LOW',
    };
    expect(replanner.shouldReplan(plan, 2)).toBe(true);
  });
});
