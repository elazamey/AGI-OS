// ============================================================================
// AGI OS - Task System
// Task creation, lifecycle management, and validation
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import {
  type Task,
  type TaskState,
  type TaskPriority,
  type TaskResult,
  type TaskError
} from './types.js';
import { TaskStateMachine } from './state-machine.js';

// ---------------------------------------------------------------------------
// Create a new task
// ---------------------------------------------------------------------------
export function createTask(
  missionId: string,
  name: string,
  options: {
    description?: string;
    priority?: TaskPriority;
    dependencies?: string[];
    maxRetries?: number;
    timeout?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Task {
  const timestamp = now();

  return {
    id: generateId(),
    missionId,
    name,
    description: options.description,
    state: 'pending',
    priority: options.priority || 'medium',
    dependencies: options.dependencies || [],
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    timeout: options.timeout,
    metadata: options.metadata ? { ...options.metadata } : {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// ---------------------------------------------------------------------------
// Task Manager - Manages task lifecycle
// ---------------------------------------------------------------------------
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private stateMachines: Map<string, TaskStateMachine> = new Map();

  /**
   * Add a task
   */
  addTask(task: Task): void {
    this.tasks.set(task.id, { ...task });
    this.stateMachines.set(task.id, new TaskStateMachine(task.state));
  }

  /**
   * Get a task
   */
  getTask(taskId: string): Task | undefined {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : undefined;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  /**
   * Get tasks by state
   */
  getTasksByState(state: TaskState): Task[] {
    return this.getAllTasks().filter((t) => t.state === state);
  }

  /**
   * Get tasks ready to execute (all dependencies completed)
   */
  getReadyTasks(): Task[] {
    return this.getAllTasks().filter((t) => {
      if (t.state !== 'pending') return false;
      return this.areDependenciesMet(t);
    });
  }

  /**
   * Check if task dependencies are met
   */
  areDependenciesMet(task: Task): boolean {
    return task.dependencies.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep && dep.state === 'completed';
    });
  }

  /**
   * Transition task to new state
   */
  transitionTask(taskId: string, toState: TaskState): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const sm = this.stateMachines.get(taskId);
    if (!sm) {
      throw new Error(`State machine not found for task: ${taskId}`);
    }

    sm.transition(toState);

    const timestamp = now();
    task.state = toState;
    task.updatedAt = timestamp;

    // Set timestamp based on state
    switch (toState) {
      case 'running':
        task.startedAt = timestamp;
        break;
      case 'completed':
        task.completedAt = timestamp;
        break;
      case 'failed':
        task.failedAt = timestamp;
        break;
      case 'blocked':
        task.blockedAt = timestamp;
        break;
    }
  }

  /**
   * Try to transition task
   */
  tryTransitionTask(taskId: string, toState: TaskState): boolean {
    try {
      this.transitionTask(taskId, toState);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set task result
   */
  setTaskResult(taskId: string, result: TaskResult): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    task.result = result;
    task.updatedAt = now();
  }

  /**
   * Set task error
   */
  setTaskError(taskId: string, error: TaskError): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    task.error = error;
    task.updatedAt = now();
  }

  /**
   * Increment retry count
   */
  incrementRetry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    task.retryCount++;
    task.updatedAt = now();
  }

  /**
   * Check if task can be retried
   */
  canRetry(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    return task.retryCount < task.maxRetries;
  }

  /**
   * Get task state machine
   */
  getStateMachine(taskId: string): TaskStateMachine | undefined {
    return this.stateMachines.get(taskId);
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): boolean {
    this.stateMachines.delete(taskId);
    return this.tasks.delete(taskId);
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.stateMachines.clear();
  }

  /**
   * Get task count
   */
  count(): number {
    return this.tasks.size;
  }

  /**
   * Get task graph (dependencies)
   */
  getTaskGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const [id, task] of this.tasks) {
      graph.set(id, [...task.dependencies]);
    }
    return graph;
  }
}

// ---------------------------------------------------------------------------
// Task Validation
// ---------------------------------------------------------------------------
export function validateTask(task: unknown): task is Task {
  if (typeof task !== 'object' || task === null) {
    return false;
  }

  const t = task as Record<string, unknown>;

  return (
    typeof t.id === 'string' &&
    typeof t.missionId === 'string' &&
    typeof t.name === 'string' &&
    typeof t.state === 'string' &&
    typeof t.priority === 'string' &&
    Array.isArray(t.dependencies) &&
    typeof t.retryCount === 'number' &&
    typeof t.maxRetries === 'number' &&
    t.createdAt instanceof Date &&
    t.updatedAt instanceof Date
  );
}

// ---------------------------------------------------------------------------
// Task Serializer
// ---------------------------------------------------------------------------
export function serializeTask(task: Task): string {
  return JSON.stringify(task, null, 2);
}

// ---------------------------------------------------------------------------
// Task Deserializer
// ---------------------------------------------------------------------------
export function deserializeTask(json: string): Task {
  const data = JSON.parse(json);
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    failedAt: data.failedAt ? new Date(data.failedAt) : undefined,
    blockedAt: data.blockedAt ? new Date(data.blockedAt) : undefined
  };
}
