import { generateId } from '@agi-os/kernel';
import type { TaskQueue } from './TaskQueue.js';
import type { MissionState, TaskResult, AgentInstance, TaskDefinition } from './MissionRuntime.js';

export interface ExecutorConfig {
  maxConcurrentAgents?: number;
  taskTimeoutMs?: number;
  maxRetries?: number;
}

export class ConcurrentAgentExecutor {
  private config: ExecutorConfig;
  private activeAgents: Map<string, AgentInstance> = new Map();

  constructor(config: ExecutorConfig = {}) {
    this.config = {
      maxConcurrentAgents: 5,
      taskTimeoutMs: 60000,
      maxRetries: 3,
      ...config,
    };
  }

  async executeQueue(queue: TaskQueue, state: MissionState): Promise<void> {
    const completedTaskIds = new Set<string>();
    const executingTasks = new Map<string, Promise<void>>();

    while (!queue.isEmpty() || executingTasks.size > 0) {
      const readyTasks = queue.getReadyTasks(completedTaskIds);

      for (const task of readyTasks) {
        if (executingTasks.size >= (this.config.maxConcurrentAgents || 5)) {
          break;
        }

        const agent = this.getAvailableAgent(state);
        if (!agent) break;

        queue.remove(task.id);
        agent.status = 'busy';
        agent.currentTask = task.id;

        const taskPromise = this.executeTask(task, state, agent)
          .then(result => {
            state.results.set(task.id, result);
            completedTaskIds.add(task.id);
            agent.status = 'idle';
            agent.currentTask = undefined;
            executingTasks.delete(task.id);
          })
          .catch(error => {
            const result: TaskResult = {
              taskId: task.id,
              agentId: agent.id,
              status: 'failed',
              error: error.message,
              durationMs: 0,
            };
            state.results.set(task.id, result);
            completedTaskIds.add(task.id);
            agent.status = 'idle';
            agent.currentTask = undefined;
            executingTasks.delete(task.id);
          });

        executingTasks.set(task.id, taskPromise);
      }

      if (executingTasks.size > 0) {
        await Promise.race(executingTasks.values());
      }
    }
  }

  private getAvailableAgent(state: MissionState): AgentInstance | undefined {
    return state.agents.find(agent => agent.status === 'idle');
  }

  private async executeTask(
    task: TaskDefinition,
    state: MissionState,
    agent: AgentInstance
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        this.performTask(task, agent),
        this.createTimeout(this.config.taskTimeoutMs || 60000),
      ]);

      return {
        taskId: task.id,
        agentId: agent.id,
        status: 'success',
        data: result,
        durationMs: Date.now() - startTime,
        evidence: this.createEvidence(task, result),
      };
    } catch (error: any) {
      if (error.message === 'Task timeout') {
        return {
          taskId: task.id,
          agentId: agent.id,
          status: 'timeout',
          error: error.message,
          durationMs: Date.now() - startTime,
        };
      }
      throw error;
    }
  }

  private async performTask(task: TaskDefinition, agent: AgentInstance): Promise<unknown> {
    // Simulate task execution based on type
    await new Promise(resolve => setTimeout(resolve, 100));
    return { taskType: task.type, agentType: agent.type, processed: true };
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), ms);
    });
  }

  private createEvidence(task: TaskDefinition, result: unknown): import('./MissionRuntime.js').Evidence[] {
    return [
      {
        type: 'task-execution',
        hash: generateId(),
        timestamp: Date.now(),
        metadata: {
          taskType: task.type,
          resultType: typeof result,
        },
      },
    ];
  }

  getActiveAgents(): AgentInstance[] {
    return Array.from(this.activeAgents.values());
  }

  async shutdown(): Promise<void> {
    this.activeAgents.clear();
  }
}
