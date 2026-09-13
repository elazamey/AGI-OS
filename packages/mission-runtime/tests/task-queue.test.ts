import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../src/TaskQueue.js';
import type { TaskDefinition } from '../src/MissionRuntime.js';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  it('should create empty queue', () => {
    expect(queue).toBeDefined();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should enqueue tasks', () => {
    const task: TaskDefinition = {
      id: 'task-1',
      type: 'test',
      payload: {},
      priority: 1,
    };

    queue.enqueue(task);
    expect(queue.size()).toBe(1);
    expect(queue.isEmpty()).toBe(false);
  });

  it('should dequeue tasks in priority order', () => {
    const task1: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    const task2: TaskDefinition = { id: 'task-2', type: 'test', payload: {}, priority: 2 };
    const task3: TaskDefinition = { id: 'task-3', type: 'test', payload: {}, priority: 3 };

    queue.enqueue(task1);
    queue.enqueue(task2);
    queue.enqueue(task3);

    expect(queue.dequeue()?.id).toBe('task-3');
    expect(queue.dequeue()?.id).toBe('task-2');
    expect(queue.dequeue()?.id).toBe('task-1');
  });

  it('should peek without removing', () => {
    const task: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    queue.enqueue(task);

    expect(queue.peek()?.id).toBe('task-1');
    expect(queue.size()).toBe(1);
  });

  it('should remove task by id', () => {
    const task1: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    const task2: TaskDefinition = { id: 'task-2', type: 'test', payload: {}, priority: 2 };

    queue.enqueue(task1);
    queue.enqueue(task2);

    expect(queue.remove('task-1')).toBe(true);
    expect(queue.size()).toBe(1);
    expect(queue.peek()?.id).toBe('task-2');
  });

  it('should return false when removing non-existent task', () => {
    expect(queue.remove('non-existent')).toBe(false);
  });

  it('should get ready tasks without dependencies', () => {
    const task1: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    const task2: TaskDefinition = { id: 'task-2', type: 'test', payload: {}, priority: 2 };

    queue.enqueue(task1);
    queue.enqueue(task2);

    const ready = queue.getReadyTasks(new Set());
    expect(ready).toHaveLength(2);
  });

  it('should get ready tasks with completed dependencies', () => {
    const task1: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    const task2: TaskDefinition = { id: 'task-2', type: 'test', payload: {}, priority: 2, dependencies: ['task-1'] };

    queue.enqueue(task1);
    queue.enqueue(task2);

    const ready = queue.getReadyTasks(new Set(['task-1']));
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-2');
  });

  it('should not get ready tasks with uncompleted dependencies', () => {
    const task1: TaskDefinition = { id: 'task-1', type: 'test', payload: {}, priority: 1 };
    const task2: TaskDefinition = { id: 'task-2', type: 'test', payload: {}, priority: 2, dependencies: ['task-1'] };

    queue.enqueue(task1);
    queue.enqueue(task2);

    const ready = queue.getReadyTasks(new Set());
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-1');
  });

  it('should clear queue', () => {
    queue.enqueue({ id: 'task-1', type: 'test', payload: {}, priority: 1 });
    queue.enqueue({ id: 'task-2', type: 'test', payload: {}, priority: 2 });

    queue.clear();
    expect(queue.isEmpty()).toBe(true);
  });

  it('should return all tasks', () => {
    queue.enqueue({ id: 'task-1', type: 'test', payload: {}, priority: 1 });
    queue.enqueue({ id: 'task-2', type: 'test', payload: {}, priority: 2 });

    const tasks = queue.getTasks();
    expect(tasks).toHaveLength(2);
  });
});
