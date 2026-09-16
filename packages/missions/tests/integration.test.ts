import { describe, it, expect, beforeEach } from 'vitest';
import type {
  MissionManager,
  MissionRunner} from '../src/mission.js';
import {
  createMissionManager,
  createMissionRunner
} from '../src/mission.js';
import { createTaskGraph } from '../src/task-graph.js';
import type { Task, TaskExecutor, TaskResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// Integration Test Executor - Simulates real task execution
// ---------------------------------------------------------------------------
class IntegrationTestExecutor implements TaskExecutor {
  private executionHistory: Array<{
    taskId: string;
    taskName: string;
    success: boolean;
    timestamp: Date;
  }> = [];
  private failTasks: Set<string> = new Set();
  private retryCount: Map<string, number> = new Map();

  setFailTask(taskId: string): void {
    this.failTasks.add(taskId);
  }

  getExecutionHistory(): Array<{
    taskId: string;
    taskName: string;
    success: boolean;
    timestamp: Date;
  }> {
    return [...this.executionHistory];
  }

  getRetryCount(taskId: string): number {
    return this.retryCount.get(taskId) || 0;
  }

  async execute(task: Task): Promise<TaskResult> {
    // Track retry count
    const currentRetry = this.retryCount.get(task.id) || 0;

    // Check if this task should fail
    if (this.failTasks.has(task.id)) {
      this.executionHistory.push({
        taskId: task.id,
        taskName: task.name,
        success: false,
        timestamp: new Date()
      });
      this.retryCount.set(task.id, currentRetry + 1);
      throw new Error(`Task ${task.id} failed`);
    }

    // Success
    this.executionHistory.push({
      taskId: task.id,
      taskName: task.name,
      success: true,
      timestamp: new Date()
    });

    return {
      success: true,
      data: { output: `Completed ${task.name}` },
      output: `Output for ${task.name}`,
      duration: Math.random() * 100 + 50
    };
  }
}

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------
describe('Integration Tests', () => {
  let manager: MissionManager;
  let executor: IntegrationTestExecutor;
  let runner: MissionRunner;

  beforeEach(() => {
    manager = createMissionManager();
    executor = new IntegrationTestExecutor();
    runner = createMissionRunner(manager, executor);
  });

  describe('Goal → Completed Workflow', () => {
    it('should complete simple mission from goal to completion', async () => {
      // 1. Create mission with goal
      const mission = manager.createMission('Build authentication system');
      expect(mission.state).toBe('created');
      expect(mission.goal).toBe('Build authentication system');

      // 2. Add tasks
      const task1 = manager.addTask(mission.id, 'Design schema', {
        description: 'Design database schema for auth',
        priority: 'high'
      });

      const task2 = manager.addTask(mission.id, 'Implement API', {
        description: 'Implement auth API endpoints',
        priority: 'high',
        dependencies: [task1.id]
      });

      manager.addTask(mission.id, 'Write tests', {
        description: 'Write integration tests',
        priority: 'medium',
        dependencies: [task2.id]
      });

      expect(mission.tasks).toHaveLength(3);

      // 3. Verify task dependencies
      const graph = createTaskGraph(mission.tasks);
      const validation = graph.validate();
      expect(validation.valid).toBe(true);

      // 4. Execute mission
      const result = await runner.execute(mission.id);

      // 5. Verify completion
      expect(result.state).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(result.tasks).toHaveLength(3);

      // 6. Verify all tasks completed
      const taskManager = manager.getTaskManager(mission.id)!;
      const completedTasks = taskManager.getTasksByState('completed');
      expect(completedTasks).toHaveLength(3);

      // 7. Verify execution order
      const history = executor.getExecutionHistory();
      expect(history).toHaveLength(3);
      expect(history[0].taskName).toBe('Design schema');
      expect(history[1].taskName).toBe('Implement API');
      expect(history[2].taskName).toBe('Write tests');
    });

    it('should handle mission with parallel tasks', async () => {
      const mission = manager.createMission('Parallel tasks');

      const task1 = manager.addTask(mission.id, 'Task A');
      const task2 = manager.addTask(mission.id, 'Task B');
      manager.addTask(mission.id, 'Task C', {
        dependencies: [task1.id, task2.id]
      });

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('completed');

      // Verify parallel execution
      const history = executor.getExecutionHistory();
      expect(history).toHaveLength(3);

      // Task C should be last
      const taskCIndex = history.findIndex((h) => h.taskName === 'Task C');
      const taskAIndex = history.findIndex((h) => h.taskName === 'Task A');
      const taskBIndex = history.findIndex((h) => h.taskName === 'Task B');

      expect(taskCIndex).toBeGreaterThan(taskAIndex);
      expect(taskCIndex).toBeGreaterThan(taskBIndex);
    });

    it('should handle mission with task failure and retry', async () => {
      const mission = manager.createMission('Mission with retry');

      const task1 = manager.addTask(mission.id, 'Flaky task', {
        maxRetries: 3
      });

      // Fail first two attempts, succeed on third
      executor.setFailTask(task1.id);

      const result = await runner.execute(mission.id);

      // Should fail because task always fails
      expect(result.state).toBe('failed');
      expect(result.error).toBeDefined();

      // Verify retry attempts
      const retryCount = executor.getRetryCount(task1.id);
      expect(retryCount).toBeGreaterThan(0);
    });

    it('should handle mission cancellation', async () => {
      const mission = manager.createMission('Cancellation test');

      manager.addTask(mission.id, 'Long task');
      manager.addTask(mission.id, 'Another task');

      // Cancel before execution
      manager.cancelMission(mission.id);

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('cancelled');
      expect(updated!.cancelledAt).toBeDefined();

      // Verify tasks are cancelled
      const taskManager = manager.getTaskManager(mission.id)!;
      const cancelledTasks = taskManager.getTasksByState('cancelled');
      expect(cancelledTasks.length).toBeGreaterThan(0);
    });

    it('should record events throughout mission lifecycle', async () => {
      const mission = manager.createMission('Event tracking');
      manager.addTask(mission.id, 'Task 1');

      await runner.execute(mission.id);

      const events = manager.getMissionEvents(mission.id);

      // Verify event types
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('mission.created');
      expect(eventTypes).toContain('task.created');
      expect(eventTypes).toContain('mission.planning');
      expect(eventTypes).toContain('mission.ready');
      expect(eventTypes).toContain('mission.running');
      expect(eventTypes).toContain('mission.completed');

      // Verify events have revision numbers
      for (const event of events) {
        expect(event.revision).toBeGreaterThanOrEqual(0);
      }
    });

    it('should maintain state integrity throughout mission', async () => {
      const mission = manager.createMission('State integrity');
      const task1 = manager.addTask(mission.id, 'Task 1');
      manager.addTask(mission.id, 'Task 2', { dependencies: [task1.id] });

      const result = await runner.execute(mission.id);

      // Verify final state
      expect(result.state).toBe('completed');
      expect(result.revision).toBeGreaterThan(0);

      // Verify state machine history
      const sm = manager.getStateMachine(mission.id);
      expect(sm).toBeDefined();
      const history = sm!.getHistory();
      expect(history.length).toBeGreaterThan(0);

      // Verify state transitions are valid
      for (const transition of history) {
        expect(transition.from).toBeDefined();
        expect(transition.to).toBeDefined();
        expect(transition.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should handle complex dependency graph', async () => {
      const mission = manager.createMission('Complex dependencies');

      // Create a diamond dependency graph
      // A → B → D
      // A → C → D
      const taskA = manager.addTask(mission.id, 'Task A');
      const taskB = manager.addTask(mission.id, 'Task B', { dependencies: [taskA.id] });
      const taskC = manager.addTask(mission.id, 'Task C', { dependencies: [taskA.id] });
      manager.addTask(mission.id, 'Task D', { dependencies: [taskB.id, taskC.id] });

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('completed');

      // Verify execution order respects dependencies
      const history = executor.getExecutionHistory();
      const taskOrder = history.map((h) => h.taskName);

      const aIndex = taskOrder.indexOf('Task A');
      const bIndex = taskOrder.indexOf('Task B');
      const cIndex = taskOrder.indexOf('Task C');
      const dIndex = taskOrder.indexOf('Task D');

      // A must be before B and C
      expect(aIndex).toBeLessThan(bIndex);
      expect(aIndex).toBeLessThan(cIndex);

      // B and C must be before D
      expect(bIndex).toBeLessThan(dIndex);
      expect(cIndex).toBeLessThan(dIndex);
    });

    it('should handle mission with all tasks failing', async () => {
      const mission = manager.createMission('All fail');

      const task1 = manager.addTask(mission.id, 'Task 1', { maxRetries: 1 });
      const task2 = manager.addTask(mission.id, 'Task 2', { maxRetries: 1 });

      executor.setFailTask(task1.id);
      executor.setFailTask(task2.id);

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle mission with single task', async () => {
      const mission = manager.createMission('Single task');
      manager.addTask(mission.id, 'Only task');

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('completed');
      expect(result.tasks).toHaveLength(1);
    });

    it('should provide evidence of execution', async () => {
      const mission = manager.createMission('Evidence test');
      manager.addTask(mission.id, 'Task 1');

      await runner.execute(mission.id);

      // Verify execution history exists
      const history = executor.getExecutionHistory();
      expect(history.length).toBeGreaterThan(0);

      // Verify task results
      const taskManager = manager.getTaskManager(mission.id)!;
      const tasks = taskManager.getAllTasks();
      for (const task of tasks) {
        expect(task.result).toBeDefined();
        expect(task.result!.success).toBe(true);
        expect(task.result!.duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('State Machine Integration', () => {
    it('should reject invalid state transitions', () => {
      const mission = manager.createMission('Invalid transitions');

      // Try to jump from created to completed
      expect(() => manager.transitionMission(mission.id, 'completed')).toThrow();

      // Try to jump from created to running
      expect(() => manager.transitionMission(mission.id, 'running')).toThrow();
    });

    it('should allow valid state transitions', () => {
      const mission = manager.createMission('Valid transitions');

      manager.transitionMission(mission.id, 'planning');
      manager.transitionMission(mission.id, 'ready');
      manager.transitionMission(mission.id, 'running');

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('running');
    });
  });

  describe('Task Graph Integration', () => {
    it('should detect circular dependencies', () => {
      const mission = manager.createMission('Circular deps');

      const task1 = manager.addTask(mission.id, 'Task 1');
      const task2 = manager.addTask(mission.id, 'Task 2', { dependencies: [task1.id] });

      // Manually create circular dependency
      const taskManager = manager.getTaskManager(mission.id)!;
      const t1 = taskManager.getTask(task1.id)!;
      t1.dependencies = [task2.id];

      const graph = createTaskGraph([t1, task2]);
      expect(graph.hasCycle()).toBe(true);
    });

    it('should validate dependency graph', () => {
      const mission = manager.createMission('Validation');

      const task1 = manager.addTask(mission.id, 'Task 1');
      manager.addTask(mission.id, 'Task 2', { dependencies: [task1.id] });

      const graph = createTaskGraph(mission.tasks);
      const validation = graph.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Event Store Integration', () => {
    it('should track all mission events', async () => {
      const mission = manager.createMission('Event tracking');
      manager.addTask(mission.id, 'Task 1');

      await runner.execute(mission.id);

      const eventStore = manager.getEventStore(mission.id);
      expect(eventStore).toBeDefined();

      const events = eventStore!.getAllEvents();
      expect(events.length).toBeGreaterThan(0);

      // Verify events are ordered by revision
      for (let i = 1; i < events.length; i++) {
        expect(events[i].revision).toBeGreaterThanOrEqual(events[i - 1].revision);
      }
    });

    it('should track task events separately', async () => {
      const mission = manager.createMission('Task events');
      const task1 = manager.addTask(mission.id, 'Task 1');

      await runner.execute(mission.id);

      const eventStore = manager.getEventStore(mission.id)!;
      const taskEvents = eventStore.getTaskEvents(task1.id);

      expect(taskEvents.length).toBeGreaterThan(0);
      expect(taskEvents.every((e) => e.taskId === task1.id)).toBe(true);
    });
  });
});
