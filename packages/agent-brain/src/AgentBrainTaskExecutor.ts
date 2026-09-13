import type { TaskExecutor, Task, MissionContext, TaskResult } from '@agi-os/missions';
import type { BrainContext } from './types.js';
import type { DecisionLoop } from './DecisionLoop.js';

export class AgentBrainTaskExecutor implements TaskExecutor {
  constructor(deps: {
    decisionLoop: DecisionLoop;
  }) {
    this.decisionLoop = deps.decisionLoop;
  }

  private decisionLoop: DecisionLoop;

  async execute(task: Task, context: MissionContext): Promise<TaskResult> {
    const brainContext: BrainContext = {
      missionId: context.missionId,
      taskId: task.id,
      goal: context.missionGoal,
      taskDescription: task.description ?? task.name,
      history: [],
      observations: [],
      workingMemory: context.getState(),
    };

    const result = await this.decisionLoop.run(brainContext);

    return {
      success: result.success,
      data: result.output,
      output: result.success ? JSON.stringify(result.output) : undefined,
      duration: result.decisions.length * 1000,
    };
  }

  canExecute(task: Task): boolean {
    return true;
  }
}
