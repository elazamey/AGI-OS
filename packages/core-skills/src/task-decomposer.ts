import { generateId } from '@agi-os/kernel';
import type { Goal, DecomposedTask, PlanStep } from './types.js';

export class TaskDecomposer {
  decompose(goal: Goal): DecomposedTask {
    const steps = this.createSteps(goal);
    const parallelGroups = this.findParallelGroups(steps);
    const criticalPath = this.findCriticalPath(steps);

    return {
      id: generateId(),
      parentGoalId: goal.id,
      steps,
      parallelGroups,
      criticalPath,
    };
  }

  private createSteps(goal: Goal): PlanStep[] {
    const steps: PlanStep[] = [];
    const desc = goal.description.toLowerCase();

    steps.push({
      id: generateId(),
      skillId: 'intent-analyzer',
      description: 'Analyze intent',
      input: { goal: goal.description },
      dependencies: [],
      status: 'pending',
    });

    if (desc.includes('بحث') || desc.includes('search') || desc.includes('find') || desc.includes('قارن')) {
      steps.push({
        id: generateId(),
        skillId: 'research',
        description: 'Research and gather information',
        input: { query: goal.description },
        dependencies: [steps[0].id],
        status: 'pending',
      });
    }

    if (desc.includes('كود') || desc.includes('code') || desc.includes('ابنِ') || desc.includes('build')) {
      steps.push({
        id: generateId(),
        skillId: 'coding',
        description: 'Write code',
        input: { goal: goal.description },
        dependencies: [steps[0].id],
        status: 'pending',
      });
    }

    if (desc.includes('تقرير') || desc.includes('report')) {
      steps.push({
        id: generateId(),
        skillId: 'artifact',
        description: 'Generate report',
        input: { format: 'markdown' },
        dependencies: steps.map(s => s.id),
        status: 'pending',
      });
    }

    if (steps.length === 1) {
      steps.push({
        id: generateId(),
        skillId: 'general',
        description: 'Execute task',
        input: { goal: goal.description },
        dependencies: [steps[0].id],
        status: 'pending',
      });
    }

    return steps;
  }

  private findParallelGroups(steps: PlanStep[]): string[][] {
    const groups: string[][] = [];
    const depMap = new Map(steps.map(s => [s.id, s.dependencies]));
    const ready = steps.filter(s => s.dependencies.length === 0);
    if (ready.length > 1) groups.push(ready.map(s => s.id));
    return groups;
  }

  private findCriticalPath(steps: PlanStep[]): string[] {
    return steps.map(s => s.id);
  }
}
