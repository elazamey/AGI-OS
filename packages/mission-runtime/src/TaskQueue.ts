import type { TaskDefinition } from './MissionRuntime.js';

export class TaskQueue {
  private queue: TaskDefinition[] = [];

  enqueue(task: TaskDefinition): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): TaskDefinition | undefined {
    return this.queue.shift();
  }

  peek(): TaskDefinition | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getTasks(): TaskDefinition[] {
    return [...this.queue];
  }

  remove(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  getReadyTasks(completedTaskIds: Set<string>): TaskDefinition[] {
    return this.queue.filter(task => {
      if (completedTaskIds.has(task.id)) {
        return false;
      }
      if (!task.dependencies || task.dependencies.length === 0) {
        return true;
      }
      return task.dependencies.every(dep => completedTaskIds.has(dep));
    });
  }

  clear(): void {
    this.queue = [];
  }
}
