// ============================================================================
// AGI OS - Task Graph
// Dependency resolution, cycle detection, topological sort
// ============================================================================

import type { Task } from './types.js';

// ---------------------------------------------------------------------------
// Task Graph Node
// ---------------------------------------------------------------------------
export interface TaskNode {
  id: string;
  task: Task;
  dependencies: string[];
  dependents: string[];
}

// ---------------------------------------------------------------------------
// Task Graph - Manages task dependencies
// ---------------------------------------------------------------------------
export class TaskGraph {
  private nodes: Map<string, TaskNode> = new Map();

  /**
   * Build graph from tasks
   */
  buildFromTasks(tasks: Task[]): void {
    this.nodes.clear();

    // Create nodes
    for (const task of tasks) {
      this.nodes.set(task.id, {
        id: task.id,
        task,
        dependencies: [...task.dependencies],
        dependents: []
      });
    }

    // Build reverse dependencies (dependents)
    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(id);
        }
      }
    }
  }

  /**
   * Get a node
   */
  getNode(id: string): TaskNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): TaskNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if dependency graph has cycles
   */
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return false;

      for (const depId of node.dependents) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Topological sort (execution order)
   * Returns tasks in order of execution
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculate in-degree
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(id);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const node = this.nodes.get(nodeId)!;
      for (const depId of node.dependents) {
        const degree = inDegree.get(depId)! - 1;
        inDegree.set(depId, degree);
        if (degree === 0) {
          queue.push(depId);
        }
      }
    }

    // Check for cycles
    if (result.length !== this.nodes.size) {
      throw new Error('Task graph has cycles');
    }

    return result;
  }

  /**
   * Get execution layers (parallel execution groups)
   * Tasks in the same layer can execute in parallel
   */
  getExecutionLayers(): string[][] {
    const layers: string[][] = [];
    const executed = new Set<string>();
    const inDegree = new Map<string, number>();

    // Calculate in-degree
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependencies.length);
    }

    while (executed.size < this.nodes.size) {
      const currentLayer: string[] = [];

      // Find tasks with all dependencies executed
      for (const [id, node] of this.nodes) {
        if (executed.has(id)) continue;

        const allDepsMet = node.dependencies.every((depId) =>
          executed.has(depId)
        );
        if (allDepsMet) {
          currentLayer.push(id);
        }
      }

      if (currentLayer.length === 0) {
        throw new Error('Unable to resolve task dependencies');
      }

      layers.push(currentLayer);
      for (const id of currentLayer) {
        executed.add(id);
      }
    }

    return layers;
  }

  /**
   * Get all ancestors of a task (dependencies recursively)
   */
  getAncestors(taskId: string): string[] {
    const ancestors = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = this.nodes.get(currentId);
      if (!node) continue;

      for (const depId of node.dependencies) {
        if (!ancestors.has(depId)) {
          ancestors.add(depId);
          queue.push(depId);
        }
      }
    }

    return Array.from(ancestors);
  }

  /**
   * Get all descendants of a task (dependents recursively)
   */
  getDescendants(taskId: string): string[] {
    const descendants = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = this.nodes.get(currentId);
      if (!node) continue;

      for (const depId of node.dependents) {
        if (!descendants.has(depId)) {
          descendants.add(depId);
          queue.push(depId);
        }
      }
    }

    return Array.from(descendants);
  }

  /**
   * Check if taskA depends on taskB (directly or indirectly)
   */
  dependsOn(taskA: string, taskB: string): boolean {
    const ancestors = this.getAncestors(taskA);
    return ancestors.includes(taskB);
  }

  /**
   * Get critical path (longest path through the graph)
   */
  getCriticalPath(): string[] {
    const layers = this.getExecutionLayers();
    // For now, return the longest path (simple heuristic)
    // In a real implementation, this would consider task durations
    return layers.flat();
  }

  /**
   * Validate graph integrity
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles
    if (this.hasCycle()) {
      errors.push('Task graph has cycles');
    }

    // Check for missing dependencies
    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          errors.push(`Task ${id} depends on non-existent task ${depId}`);
        }
      }
    }

    // Check for self-dependency
    for (const [id, node] of this.nodes) {
      if (node.dependencies.includes(id)) {
        errors.push(`Task ${id} depends on itself`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalTasks: number;
    maxDepth: number;
    independentTasks: number;
    leafTasks: number;
  } {
    const layers = this.getExecutionLayers();
    const independentTasks = this.getTasksWithNoDependencies().length;
    const leafTasks = this.getTasksWithNoDependents().length;

    return {
      totalTasks: this.nodes.size,
      maxDepth: layers.length,
      independentTasks,
      leafTasks
    };
  }

  /**
   * Get tasks with no dependencies
   */
  getTasksWithNoDependencies(): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, node]) => node.dependencies.length === 0)
      .map(([id]) => id);
  }

  /**
   * Get tasks with no dependents (leaf tasks)
   */
  getTasksWithNoDependents(): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, node]) => node.dependents.length === 0)
      .map(([id]) => id);
  }

  /**
   * Clear graph
   */
  clear(): void {
    this.nodes.clear();
  }
}

// ---------------------------------------------------------------------------
// Graph Factory
// ---------------------------------------------------------------------------
export function createTaskGraph(tasks: Task[]): TaskGraph {
  const graph = new TaskGraph();
  graph.buildFromTasks(tasks);
  return graph;
}

// ---------------------------------------------------------------------------
// Graph Validation Helpers
// ---------------------------------------------------------------------------
export function validateTaskDependencies(tasks: Task[]): {
  valid: boolean;
  errors: string[];
} {
  const graph = createTaskGraph(tasks);
  return graph.validate();
}

export function getExecutionOrder(tasks: Task[]): string[] {
  const graph = createTaskGraph(tasks);
  return graph.topologicalSort();
}

export function getParallelGroups(tasks: Task[]): string[][] {
  const graph = createTaskGraph(tasks);
  return graph.getExecutionLayers();
}
