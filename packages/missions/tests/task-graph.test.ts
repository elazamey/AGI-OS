import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskGraph,
  createTaskGraph,
  validateTaskDependencies,
  getExecutionOrder,
  getParallelGroups
} from '../src/task-graph.js';
import { createTask } from '../src/task.js';
import type { Task } from '../src/types.js';

describe('TaskGraph', () => {
  describe('TaskGraph', () => {
    let graph: TaskGraph;

    beforeEach(() => {
      graph = new TaskGraph();
    });

    it('should build from tasks', () => {
      const tasks = [
        createTask('m1', 'Task 1'),
        createTask('m1', 'Task 2', { dependencies: ['task-1'] })
      ];

      graph.buildFromTasks(tasks);
      expect(graph.getAllNodes()).toHaveLength(2);
    });

    it('should detect no cycle in linear graph', () => {
      const tasks = [
        createTask('m1', 'Task 1'),
        createTask('m1', 'Task 2', { dependencies: ['task-1'] })
      ];

      graph.buildFromTasks(tasks);
      expect(graph.hasCycle()).toBe(false);
    });

    it('should detect cycle', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2');

      // Create circular dependency manually
      task1.dependencies = [task2.id];
      task2.dependencies = [task1.id];

      graph.buildFromTasks([task1, task2]);
      expect(graph.hasCycle()).toBe(true);
    });

    it('should perform topological sort', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });
      const task3 = createTask('m1', 'Task 3', { dependencies: [task2.id] });

      graph.buildFromTasks([task1, task2, task3]);
      const order = graph.topologicalSort();

      expect(order).toHaveLength(3);
      expect(order.indexOf(task1.id)).toBeLessThan(order.indexOf(task2.id));
      expect(order.indexOf(task2.id)).toBeLessThan(order.indexOf(task3.id));
    });

    it('should throw on cycle in topological sort', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2');

      task1.dependencies = [task2.id];
      task2.dependencies = [task1.id];

      graph.buildFromTasks([task1, task2]);
      expect(() => graph.topologicalSort()).toThrow('cycles');
    });

    it('should get execution layers', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2');
      const task3 = createTask('m1', 'Task 3', { dependencies: [task1.id] });
      const task4 = createTask('m1', 'Task 4', { dependencies: [task2.id] });

      graph.buildFromTasks([task1, task2, task3, task4]);
      const layers = graph.getExecutionLayers();

      // Layer 0: task1, task2 (no dependencies)
      // Layer 1: task3, task4 (depend on task1 and task2)
      expect(layers).toHaveLength(2);
      expect(layers[0]).toHaveLength(2);
      expect(layers[1]).toHaveLength(2);
    });

    it('should get ancestors', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });
      const task3 = createTask('m1', 'Task 3', { dependencies: [task2.id] });

      graph.buildFromTasks([task1, task2, task3]);
      const ancestors = graph.getAncestors(task3.id);

      expect(ancestors).toContain(task1.id);
      expect(ancestors).toContain(task2.id);
    });

    it('should get descendants', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });
      const task3 = createTask('m1', 'Task 3', { dependencies: [task2.id] });

      graph.buildFromTasks([task1, task2, task3]);
      const descendants = graph.getDescendants(task1.id);

      expect(descendants).toContain(task2.id);
      expect(descendants).toContain(task3.id);
    });

    it('should check if task depends on another', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      graph.buildFromTasks([task1, task2]);

      expect(graph.dependsOn(task2.id, task1.id)).toBe(true);
      expect(graph.dependsOn(task1.id, task2.id)).toBe(false);
    });

    it('should validate graph', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      graph.buildFromTasks([task1, task2]);
      const validation = graph.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const task1 = createTask('m1', 'Task 1', { dependencies: ['non-existent'] });

      graph.buildFromTasks([task1]);
      const validation = graph.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect self-dependency', () => {
      const task1 = createTask('m1', 'Task 1');
      task1.dependencies = [task1.id];

      graph.buildFromTasks([task1]);
      const validation = graph.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.stringContaining('depends on itself')
      );
    });

    it('should get graph stats', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2');
      const task3 = createTask('m1', 'Task 3', { dependencies: [task1.id] });

      graph.buildFromTasks([task1, task2, task3]);
      const stats = graph.getStats();

      expect(stats.totalTasks).toBe(3);
      expect(stats.maxDepth).toBe(2);
      expect(stats.independentTasks).toBe(2);
      expect(stats.leafTasks).toBe(2);
    });

    it('should get tasks with no dependencies', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      graph.buildFromTasks([task1, task2]);
      const independent = graph.getTasksWithNoDependencies();

      expect(independent).toHaveLength(1);
      expect(independent).toContain(task1.id);
    });

    it('should get tasks with no dependents', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      graph.buildFromTasks([task1, task2]);
      const leaves = graph.getTasksWithNoDependents();

      expect(leaves).toHaveLength(1);
      expect(leaves).toContain(task2.id);
    });

    it('should clear graph', () => {
      const task1 = createTask('m1', 'Task 1');
      graph.buildFromTasks([task1]);

      graph.clear();
      expect(graph.getAllNodes()).toHaveLength(0);
    });
  });

  describe('Helper Functions', () => {
    it('createTaskGraph', () => {
      const tasks = [
        createTask('m1', 'Task 1'),
        createTask('m1', 'Task 2', { dependencies: ['task-1'] })
      ];

      const graph = createTaskGraph(tasks);
      expect(graph).toBeInstanceOf(TaskGraph);
      expect(graph.getAllNodes()).toHaveLength(2);
    });

    it('validateTaskDependencies', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      const result = validateTaskDependencies([task1, task2]);
      expect(result.valid).toBe(true);
    });

    it('getExecutionOrder', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2', { dependencies: [task1.id] });

      const order = getExecutionOrder([task1, task2]);
      expect(order).toHaveLength(2);
      expect(order.indexOf(task1.id)).toBeLessThan(order.indexOf(task2.id));
    });

    it('getParallelGroups', () => {
      const task1 = createTask('m1', 'Task 1');
      const task2 = createTask('m1', 'Task 2');
      const task3 = createTask('m1', 'Task 3', { dependencies: [task1.id] });

      const groups = getParallelGroups([task1, task2, task3]);
      expect(groups).toHaveLength(2);
    });
  });
});
