import { describe, it, expect, vi } from 'vitest';
import { EventLoop } from '../src/event-loop.js';
import type { Perceivable, Plannable, Executable, Reflectable, Memorizable } from '../src/event-loop.js';

function createMockPerceivable(goal?: string): Perceivable {
  return {
    perceive: vi.fn().mockResolvedValue(
      goal ? { goal, goalId: `goal-${goal}`, context: {} } : null
    ),
  };
}

function createMockPlannable(): Plannable {
  return {
    plan: vi.fn().mockResolvedValue({
      planId: 'plan-1',
      missionId: 'mission-1',
      steps: [{ action: 'step1' }],
      expectedOutcome: 'Done',
      predictedSuccess: 0.8,
    }),
  };
}

function createMockExecutable(success = true): Executable {
  return {
    execute: vi.fn().mockResolvedValue({
      missionId: 'mission-1',
      success,
      actualOutcome: success ? 'Done' : 'Failed',
      duration: 100,
      evidenceRefs: ['ev-1'],
    }),
  };
}

function createMockReflectable(): Reflectable {
  return {
    reflect: vi.fn().mockResolvedValue({
      lessonsCount: 1,
      memoryWrites: [{ type: 'lesson' }],
    }),
  };
}

function createMockMemorizable(): Memorizable {
  return {
    memorize: vi.fn().mockResolvedValue(undefined),
  };
}

function createFullLoop(params?: {
  perceivable?: Perceivable;
  plannable?: Plannable;
  executable?: Executable;
  reflectable?: Reflectable;
  memorizable?: Memorizable;
  maxIterations?: number;
}) {
  return new EventLoop({
    perceivable: params?.perceivable ?? createMockPerceivable('test-goal'),
    plannable: params?.plannable ?? createMockPlannable(),
    executable: params?.executable ?? createMockExecutable(),
    reflectable: params?.reflectable ?? createMockReflectable(),
    memorizable: params?.memorizable ?? createMockMemorizable(),
    config: { maxIterations: params?.maxIterations ?? 3, idleDelayMs: 0, errorBackoffMs: 0 },
  });
}

// ===================================================================
// EventLoop — Core Pipeline
// ===================================================================
describe('EventLoop', () => {
  it('should initialize in idle state', () => {
    const loop = createFullLoop();
    expect(loop.getState()).toBe('idle');
  });

  it('should run a single iteration successfully', async () => {
    const loop = createFullLoop({ maxIterations: 1 });
    await loop.run();

    const results = loop.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe('success');
  });

  it('should run multiple iterations', async () => {
    const loop = createFullLoop({ maxIterations: 3 });
    await loop.run();

    expect(loop.getResults()).toHaveLength(3);
  });

  it('should skip when perceivable returns null', async () => {
    const perceivable = createMockPerceivable(); // returns undefined (no goal)
    const loop = createFullLoop({ perceivable, maxIterations: 1 });
    await loop.run();

    const results = loop.getResults();
    expect(results[0].outcome).toBe('skipped');
  });

  it('should handle execution failure without crashing', async () => {
    const executable = createMockExecutable(false);
    const loop = createFullLoop({ executable, maxIterations: 1 });
    await loop.run();

    const results = loop.getResults();
    expect(results[0].outcome).toBe('failure');
  });

  it('should handle planner returning null', async () => {
    const plannable: Plannable = { plan: vi.fn().mockResolvedValue(null) };
    const loop = createFullLoop({ plannable, maxIterations: 1 });
    await loop.run();

    const results = loop.getResults();
    expect(results[0].outcome).toBe('skipped');
  });

  it('should produce stats after run', async () => {
    const loop = createFullLoop({ maxIterations: 3 });
    await loop.run();

    const stats = loop.getStats();
    expect(stats.totalIterations).toBe(3);
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should track consecutive errors and circuit break', async () => {
    const perceivable = {
      perceive: vi.fn().mockRejectedValue(new Error('fail')),
    };

    const loop = new EventLoop({
      perceivable,
      plannable: createMockPlannable(),
      executable: createMockExecutable(),
      reflectable: createMockReflectable(),
      memorizable: createMockMemorizable(),
      config: { maxIterations: 100, maxConsecutiveErrors: 3, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    const results = loop.getResults();
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results.every((r) => r.outcome === 'error')).toBe(true);
  });

  it('should allow graceful shutdown', async () => {
    const perceivable = {
      perceive: vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 2));
        return { goal: 'goal', goalId: 'g1', context: {} };
      }),
    };
    const loop = new EventLoop({
      perceivable,
      plannable: createMockPlannable(),
      executable: createMockExecutable(),
      reflectable: createMockReflectable(),
      memorizable: createMockMemorizable(),
      config: { maxIterations: 100, idleDelayMs: 0, errorBackoffMs: 0 },
    });
    setTimeout(() => loop.shutdown(), 20);
    await loop.run();
    expect(loop.getResults().length).toBeLessThan(100);
  });

  it('should invoke callbacks', async () => {
    const onIterationStart = vi.fn();
    const onIterationEnd = vi.fn();
    const onShutdown = vi.fn();

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(),
      reflectable: createMockReflectable(),
      memorizable: createMockMemorizable(),
      config: { maxIterations: 1, idleDelayMs: 0, errorBackoffMs: 0 },
      callbacks: { onIterationStart, onIterationEnd, onShutdown },
    });

    await loop.run();

    expect(onIterationStart).toHaveBeenCalledWith(1);
    expect(onIterationEnd).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledWith('max_iterations');
  });

  it('should invoke onError on exception', async () => {
    const onError = vi.fn();
    const perceivable = {
      perceive: vi.fn().mockRejectedValue(new Error('boom')),
    };

    const loop = new EventLoop({
      perceivable,
      plannable: createMockPlannable(),
      executable: createMockExecutable(),
      reflectable: createMockReflectable(),
      memorizable: createMockMemorizable(),
      config: { maxIterations: 1, maxConsecutiveErrors: 1, idleDelayMs: 0, errorBackoffMs: 0 },
      callbacks: { onError },
    });

    await loop.run();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('boom');
  });

  it('should call reflect and memorize in pipeline', async () => {
    const reflectable = createMockReflectable();
    const memorizable = createMockMemorizable();

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable,
      memorizable,
      config: { maxIterations: 1, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    expect(reflectable.reflect).toHaveBeenCalledTimes(1);
    expect(memorizable.memorize).toHaveBeenCalledTimes(1);
  });

  it('should skip reflection when disabled', async () => {
    const reflectable = createMockReflectable();

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable,
      memorizable: createMockMemorizable(),
      config: { maxIterations: 1, enableReflection: false, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    expect(reflectable.reflect).not.toHaveBeenCalled();
  });

  it('should skip memory write when disabled', async () => {
    const memorizable = createMockMemorizable();

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable: createMockReflectable(),
      memorizable,
      config: { maxIterations: 1, enableMemoryWrite: false, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    expect(memorizable.memorize).not.toHaveBeenCalled();
  });

  it('should survive reflection failure', async () => {
    const reflectable: Reflectable = {
      reflect: vi.fn().mockRejectedValue(new Error('reflection boom')),
    };

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable,
      memorizable: createMockMemorizable(),
      config: { maxIterations: 1, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    const results = loop.getResults();
    expect(results[0].outcome).toBe('success');
  });

  it('should survive memory write failure', async () => {
    const memorizable: Memorizable = {
      memorize: vi.fn().mockRejectedValue(new Error('memory boom')),
    };

    const loop = new EventLoop({
      perceivable: createMockPerceivable('goal'),
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable: createMockReflectable(),
      memorizable,
      config: { maxIterations: 1, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    const results = loop.getResults();
    expect(results[0].outcome).toBe('success');
  });

  it('should reset consecutive errors after success', async () => {
    let callCount = 0;
    const perceivable = {
      perceive: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('first fails');
        return { goal: 'goal', goalId: 'g1', context: {} };
      }),
    };

    const loop = new EventLoop({
      perceivable,
      plannable: createMockPlannable(),
      executable: createMockExecutable(true),
      reflectable: createMockReflectable(),
      memorizable: createMockMemorizable(),
      config: { maxIterations: 5, maxConsecutiveErrors: 3, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    const stats = loop.getStats();
    expect(stats.errorIterations).toBe(1);
    expect(stats.successfulIterations).toBeGreaterThanOrEqual(1);
  });
});

// ===================================================================
// Golden Test: Full Autonomous Cycle
// ===================================================================
describe('Golden Autonomous Cycle Test', () => {
  it('should complete Perceive→Plan→Execute→Reflect→Memorize', async () => {
    const perceive = vi.fn()
      .mockResolvedValueOnce({ goal: 'Deploy app', goalId: 'g1', context: {} })
      .mockResolvedValueOnce(null); // idle on second call

    const plan = vi.fn().mockResolvedValue({
      planId: 'p1', missionId: 'm1', steps: [],
      expectedOutcome: 'Deployed', predictedSuccess: 0.85,
    });

    const execute = vi.fn().mockResolvedValue({
      missionId: 'm1', success: true, actualOutcome: 'Deployed',
      duration: 500, evidenceRefs: ['ev1'],
    });

    const reflect = vi.fn().mockResolvedValue({
      lessonsCount: 1, memoryWrites: [{ type: 'lesson' }],
    });

    const memorize = vi.fn().mockResolvedValue(undefined);

    const loop = new EventLoop({
      perceivable: { perceive },
      plannable: { plan },
      executable: { execute },
      reflectable: { reflect },
      memorizable: { memorize },
      config: { maxIterations: 2, idleDelayMs: 0, errorBackoffMs: 0 },
    });

    await loop.run();

    // Verify full pipeline executed
    expect(perceive).toHaveBeenCalledTimes(2);
    expect(plan).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(reflect).toHaveBeenCalledTimes(1);
    expect(memorize).toHaveBeenCalledTimes(1);

    // Verify stats
    const stats = loop.getStats();
    expect(stats.totalIterations).toBe(2);
    expect(stats.successfulIterations).toBe(1);
    expect(stats.skippedIterations).toBe(1);
    expect(stats.totalLessonsGenerated).toBe(1);
  });
});
