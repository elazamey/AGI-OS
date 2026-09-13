import type { TaskPlan } from './types.js';

export class StopCondition {
  shouldStop(plan: TaskPlan): { stop: boolean; reason?: string } {
    const progress = this.getProgress(plan);

    if (progress.percentage === 100) return { stop: true, reason: 'All steps completed' };
    if (progress.failed > 0 && progress.failed >= progress.total * 0.5) {
      return { stop: true, reason: `Too many failures: ${progress.failed}/${progress.total}` };
    }
    if (progress.completed === 0 && progress.failed > 0) {
      return { stop: true, reason: 'First step failed' };
    }
    return { stop: false };
  }

  private getProgress(plan: TaskPlan) {
    const total = plan.steps.length;
    const completed = plan.steps.filter(s => s.status === 'completed').length;
    const failed = plan.steps.filter(s => s.status === 'failed').length;
    return { total, completed, failed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }
}
