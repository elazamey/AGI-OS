import { generateId, now } from '@agi-os/kernel';
import type { TaskPlan, ReplanResult, PlanStep } from './types.js';

export class Replanner {
  replan(plan: TaskPlan, failedStepId: string, error: string): ReplanResult {
    const failedStep = plan.steps.find(s => s.id === failedStepId);
    const dependentSteps = plan.steps.filter(s => s.dependencies.includes(failedStepId));

    for (const step of dependentSteps) {
      step.status = 'skipped';
      step.error = `Skipped due to failure in ${failedStepId}`;
    }

    const retryStep: PlanStep = {
      id: generateId(),
      skillId: 'retry',
      description: `Retry: ${failedStep?.description || 'failed step'}`,
      input: failedStep?.input || {},
      dependencies: [],
      status: 'pending',
    };
    plan.steps.push(retryStep);

    return {
      originalPlanId: plan.id,
      newPlanId: generateId(),
      changes: [`Retried step ${failedStepId}`, `Skipped ${dependentSteps.length} dependent steps`],
      reason: error,
      timestamp: now().toISOString(),
    };
  }

  shouldReplan(plan: TaskPlan, maxFailures: number = 2): boolean {
    const failures = plan.steps.filter(s => s.status === 'failed').length;
    return failures >= maxFailures;
  }
}
