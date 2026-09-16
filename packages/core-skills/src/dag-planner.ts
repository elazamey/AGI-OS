import { generateId } from '@agi-os/kernel';
import type { TaskPlan, PlanStep, DecomposedTask } from './types.js';

export class DAGPlanner {
  createPlan(task: DecomposedTask): TaskPlan {
    const dependencies = new Map<string, string[]>();
    for (const step of task.steps) {
      dependencies.set(step.id, step.dependencies);
    }

    return {
      id: generateId(),
      goalId: task.parentGoalId,
      steps: task.steps,
      dependencies,
      estimatedDuration: task.steps.length * 30000,
      riskLevel: this.assessPlanRisk(task.steps),
    };
  }

  private assessPlanRisk(steps: PlanStep[]): string {
    const riskySkills = ['exec', 'terminal', 'git-push', 'deploy'];
    const riskyCount = steps.filter(s => riskySkills.some(r => s.skillId.includes(r))).length;
    if (riskyCount > 2) return 'HIGH';
    if (riskyCount > 0) return 'MEDIUM';
    return 'LOW';
  }

  getReadySteps(plan: TaskPlan, completedIds: Set<string>): PlanStep[] {
    return plan.steps.filter(step => {
      if (step.status !== 'pending') return false;
      return step.dependencies.every(dep => completedIds.has(dep));
    });
  }

  markStepCompleted(plan: TaskPlan, stepId: string, result: unknown): void {
    const step = plan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.result = result;
    }
  }

  markStepFailed(plan: TaskPlan, stepId: string, error: string): void {
    const step = plan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'failed';
      step.error = error;
    }
  }

  getProgress(plan: TaskPlan): { total: number; completed: number; failed: number; percentage: number } {
    const total = plan.steps.length;
    const completed = plan.steps.filter(s => s.status === 'completed').length;
    const failed = plan.steps.filter(s => s.status === 'failed').length;
    return { total, completed, failed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }
}
