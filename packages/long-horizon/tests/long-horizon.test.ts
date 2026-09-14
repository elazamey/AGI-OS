import { describe, it, expect, beforeEach } from 'vitest';
import { ContextDriftTracker } from '../src/index.js';

describe('ContextDriftTracker', () => {
  let tracker: ContextDriftTracker;

  beforeEach(() => {
    tracker = new ContextDriftTracker();
  });

  it('should create tracker', () => {
    expect(tracker).toBeDefined();
  });

  it('should start session with goal', () => {
    tracker.startSession('Fix the login bug');
    const metrics = tracker.getSessionMetrics();
    expect(metrics.goal).toBe('Fix the login bug');
    expect(metrics.total_tool_calls).toBe(0);
  });

  it('should record tool calls', () => {
    tracker.startSession('Test goal');
    tracker.recordToolCall({
      name: 'read_file',
      args: { path: 'test.ts' },
      result: 'content',
      tokens_used: 100,
    });

    expect(tracker.getToolCalls().length).toBe(1);
  });

  it('should store and retrieve memory', () => {
    tracker.startSession('Test goal');
    const call = tracker.recordToolCall({
      name: 'read_file',
      args: { path: 'test.ts' },
      result: 'content',
      tokens_used: 100,
    });

    tracker.storeMemory('Important finding about the bug', call.id, 0.9);
    expect(tracker.getMemory().length).toBe(1);

    const results = tracker.retrieveMemory('bug');
    expect(results.length).toBe(1);
  });

  it('should detect simple loop', () => {
    tracker.startSession('Test goal');
    for (let i = 0; i < 3; i++) {
      tracker.recordToolCall({
        name: 'read_file',
        args: { path: 'test.ts' },
        result: 'content',
        tokens_used: 100,
      });
    }

    const loop = tracker.detectLoop();
    expect(loop.detected).toBe(true);
    expect(loop.pattern).toBe('read_file');
    expect(loop.count).toBe(3);
  });

  it('should detect pattern loop', () => {
    tracker.startSession('Test goal');
    const tools = ['read_file', 'write_file', 'grep', 'read_file', 'write_file', 'grep'];
    for (const tool of tools) {
      tracker.recordToolCall({
        name: tool,
        args: {},
        result: null,
        tokens_used: 50,
      });
    }

    const loop = tracker.detectLoop();
    expect(loop.detected).toBe(true);
    expect(loop.pattern).toBeDefined();
  });

  it('should not detect loop with varied calls', () => {
    tracker.startSession('Test goal');
    const tools = ['read_file', 'write_file', 'run_test', 'commit', 'push'];
    for (const tool of tools) {
      tracker.recordToolCall({
        name: tool,
        args: {},
        result: null,
        tokens_used: 50,
      });
    }

    const loop = tracker.detectLoop();
    expect(loop.detected).toBe(false);
  });

  it('should calculate goal retention', () => {
    tracker.startSession('Fix login bug');
    tracker.recordToolCall({
      name: 'read_file',
      args: { path: 'login.ts' },
      result: null,
      tokens_used: 50,
    });
    tracker.recordToolCall({
      name: 'grep',
      args: { pattern: 'login' },
      result: null,
      tokens_used: 50,
    });
    tracker.recordToolCall({
      name: 'unrelated_task',
      args: { data: 'random' },
      result: null,
      tokens_used: 50,
    });

    const retention = tracker.calculateGoalRetention();
    expect(retention).toBeGreaterThan(0);
    expect(retention).toBeLessThanOrEqual(1);
  });

  it('should calculate context drift', () => {
    tracker.startSession('Test goal');
    for (let i = 0; i < 10; i++) {
      tracker.recordToolCall({
        name: i < 5 ? 'read_file' : 'write_file',
        args: {},
        result: null,
        tokens_used: 50,
      });
    }

    const drift = tracker.calculateContextDrift();
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThanOrEqual(1);
  });

  it('should calculate memory accuracy', () => {
    tracker.startSession('Test goal');
    const call = tracker.recordToolCall({
      name: 'read_file',
      args: {},
      result: null,
      tokens_used: 50,
    });

    tracker.storeMemory('Important note about the system', call.id, 0.8);
    const accuracy = tracker.calculateMemoryAccuracy();
    expect(accuracy).toBe(1);
  });

  it('should get session metrics', () => {
    tracker.startSession('Test goal');
    tracker.recordToolCall({
      name: 'read_file',
      args: {},
      result: null,
      tokens_used: 50,
    });

    const metrics = tracker.getSessionMetrics();
    expect(metrics.session_id).toBeDefined();
    expect(metrics.total_tool_calls).toBe(1);
    expect(metrics.unique_tools).toContain('read_file');
    expect(metrics.goal_retention_score).toBeGreaterThanOrEqual(0);
    expect(metrics.context_drift_score).toBeGreaterThanOrEqual(0);
    expect(metrics.memory_retrieval_accuracy).toBe(1);
  });

  it('should clear data', () => {
    tracker.startSession('Test goal');
    tracker.recordToolCall({
      name: 'read_file',
      args: {},
      result: null,
      tokens_used: 50,
    });
    tracker.storeMemory('Test memory', 'call-1', 0.5);

    tracker.clear();
    expect(tracker.getToolCalls().length).toBe(0);
    expect(tracker.getMemory().length).toBe(0);
  });

  it('should handle empty session', () => {
    tracker.startSession('Test goal');
    const metrics = tracker.getSessionMetrics();
    expect(metrics.total_tool_calls).toBe(0);
    expect(metrics.goal_retention_score).toBe(1);
    expect(metrics.context_drift_score).toBe(0);
    expect(metrics.duration_ms).toBe(0);
  });
});
