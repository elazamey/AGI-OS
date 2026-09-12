import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTask,
  TaskManager,
  validateTask,
  serializeTask,
  deserializeTask
} from '../src/task.js';
import type { Task } from '../src/types.js';

describe('Task', () => {
  describe('createTask', () => {
    it('should create task with required fields', () => {
      const task = createTask('mission-1', 'Test Task');

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.missionId).toBe('mission-1');
      expect(task.name).toBe('Test Task');
      expect(task.state).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.dependencies).toEqual([]);
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create task with options', () => {
      const task = createTask('mission-1', 'Test Task', {
        description: 'Description',
        priority: 'high',
        dependencies: ['dep-1', 'dep-2'],
        maxRetries: 5,
        timeout: 60000,
        metadata: { key: 'value' }
      });

      expect(task.description).toBe('Description');
      expect(task.priority).toBe('high');
      expect(task.dependencies).toEqual(['dep-1', 'dep-2']);
      expect(task.maxRetries).toBe(5);
      expect(task.timeout).toBe(60000);
      expect(task.metadata).toEqual({ key: 'value' });
    });
  });

  describe('TaskManager', () => {
    let manager: TaskManager;

    beforeEach(() => {
      manager = new TaskManager();
    });

    it('should add and get task', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      const retrieved = manager.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(task.id);
    });

    it('should return undefined for non-existent task', () => {
      const retrieved = manager.getTask('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all tasks', () => {
      manager.addTask(createTask('mission-1', 'Task 1'));
      manager.addTask(createTask('mission-1', 'Task 2'));

      const tasks = manager.getAllTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should get tasks by state', () => {
      const task1 = createTask('mission-1', 'Task 1');
      const task2 = createTask('mission-1', 'Task 2');
      manager.addTask(task1);
      manager.addTask(task2);

      manager.transitionTask(task1.id, 'ready');
      manager.transitionTask(task1.id, 'running');

      const pendingTasks = manager.getTasksByState('pending');
      expect(pendingTasks).toHaveLength(1);

      const runningTasks = manager.getTasksByState('running');
      expect(runningTasks).toHaveLength(1);
    });

    it('should get ready tasks (dependencies met)', () => {
      const task1 = createTask('mission-1', 'Task 1');
      const task2 = createTask('mission-1', 'Task 2', {
        dependencies: [task1.id]
      });

      manager.addTask(task1);
      manager.addTask(task2);

      // Initially only task1 is ready
      let readyTasks = manager.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(task1.id);

      // Complete task1
      manager.transitionTask(task1.id, 'ready');
      manager.transitionTask(task1.id, 'running');
      manager.transitionTask(task1.id, 'completed');

      // Now task2 should be ready
      readyTasks = manager.getReadyTasks();
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe(task2.id);
    });

    it('should check dependencies are met', () => {
      const task1 = createTask('mission-1', 'Task 1');
      const task2 = createTask('mission-1', 'Task 2', {
        dependencies: [task1.id]
      });

      manager.addTask(task1);
      manager.addTask(task2);

      expect(manager.areDependenciesMet(task2)).toBe(false);

      manager.transitionTask(task1.id, 'ready');
      manager.transitionTask(task1.id, 'running');
      manager.transitionTask(task1.id, 'completed');

      expect(manager.areDependenciesMet(task2)).toBe(true);
    });

    it('should transition task', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      manager.transitionTask(task.id, 'ready');
      expect(manager.getTask(task.id)!.state).toBe('ready');

      manager.transitionTask(task.id, 'running');
      expect(manager.getTask(task.id)!.state).toBe('running');
      expect(manager.getTask(task.id)!.startedAt).toBeDefined();
    });

    it('should reject invalid transition', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      expect(() => manager.transitionTask(task.id, 'completed')).toThrow();
    });

    it('should try transition', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      expect(manager.tryTransitionTask(task.id, 'ready')).toBe(true);
      expect(manager.tryTransitionTask(task.id, 'completed')).toBe(false);
    });

    it('should set task result', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      const result = {
        success: true,
        data: { output: 'test' },
        duration: 100
      };

      manager.setTaskResult(task.id, result);
      expect(manager.getTask(task.id)!.result).toEqual(result);
    });

    it('should set task error', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      const error = {
        code: 'TEST_ERROR',
        message: 'Test error',
        retryable: true
      };

      manager.setTaskError(task.id, error);
      expect(manager.getTask(task.id)!.error).toEqual(error);
    });

    it('should increment retry count', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      expect(manager.getTask(task.id)!.retryCount).toBe(0);

      manager.incrementRetry(task.id);
      expect(manager.getTask(task.id)!.retryCount).toBe(1);

      manager.incrementRetry(task.id);
      expect(manager.getTask(task.id)!.retryCount).toBe(2);
    });

    it('should check if can retry', () => {
      const task = createTask('mission-1', 'Test Task', { maxRetries: 2 });
      manager.addTask(task);

      expect(manager.canRetry(task.id)).toBe(true);

      manager.incrementRetry(task.id);
      expect(manager.canRetry(task.id)).toBe(true);

      manager.incrementRetry(task.id);
      expect(manager.canRetry(task.id)).toBe(false);
    });

    it('should remove task', () => {
      const task = createTask('mission-1', 'Test Task');
      manager.addTask(task);

      expect(manager.removeTask(task.id)).toBe(true);
      expect(manager.getTask(task.id)).toBeUndefined();
    });

    it('should clear all tasks', () => {
      manager.addTask(createTask('mission-1', 'Task 1'));
      manager.addTask(createTask('mission-1', 'Task 2'));

      manager.clear();
      expect(manager.count()).toBe(0);
    });

    it('should count tasks', () => {
      expect(manager.count()).toBe(0);

      manager.addTask(createTask('mission-1', 'Task 1'));
      expect(manager.count()).toBe(1);

      manager.addTask(createTask('mission-1', 'Task 2'));
      expect(manager.count()).toBe(2);
    });

    it('should get task graph', () => {
      const task1 = createTask('mission-1', 'Task 1');
      const task2 = createTask('mission-1', 'Task 2', {
        dependencies: [task1.id]
      });

      manager.addTask(task1);
      manager.addTask(task2);

      const graph = manager.getTaskGraph();
      expect(graph.size).toBe(2);
      expect(graph.get(task1.id)).toEqual([]);
      expect(graph.get(task2.id)).toEqual([task1.id]);
    });
  });

  describe('validateTask', () => {
    it('should validate correct task', () => {
      const task = createTask('mission-1', 'Test Task');
      expect(validateTask(task)).toBe(true);
    });

    it('should reject invalid task', () => {
      expect(validateTask(null)).toBe(false);
      expect(validateTask({})).toBe(false);
      expect(validateTask({ id: '123' })).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip task', () => {
      const task = createTask('mission-1', 'Test Task');
      const json = serializeTask(task);
      const deserialized = deserializeTask(json);

      expect(deserialized.id).toBe(task.id);
      expect(deserialized.name).toBe(task.name);
      expect(deserialized.createdAt.getTime()).toBe(task.createdAt.getTime());
    });
  });
});
