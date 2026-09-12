// ============================================================================
// AGI OS - Plan Validator
// Deterministic validation of cognitive plans — NO execution
// ============================================================================

import type {
  CognitivePlan,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  WorldConstraint,
  PlanStep,
} from './types.js';

// ---------------------------------------------------------------------------
// Plan Validator — checks plans are valid before execution
// ---------------------------------------------------------------------------
export class PlanValidator {
  private registeredChecks: Array<{
    name: string;
    check: (plan: CognitivePlan, constraints: WorldConstraint[]) => ValidationError | ValidationWarning | null;
  }> = [];

  constructor() {
    this.registerBuiltinChecks();
  }

  /**
   * Validate a plan against constraints
   */
  validate(
    plan: CognitivePlan,
    availableCapabilities: string[],
    constraints: WorldConstraint[] = []
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Run built-in checks
    for (const { check } of this.registeredChecks) {
      const result = check(plan, constraints);
      if (result) {
        if ('severity' in result && (result as ValidationError).severity) {
          errors.push(result as ValidationError);
        } else {
          warnings.push(result as ValidationWarning);
        }
      }
    }

    // Check capabilities
    for (const cap of plan.requiredCapabilities) {
      if (!availableCapabilities.includes(cap)) {
        errors.push({
          code: 'MISSING_CAPABILITY',
          message: `Required capability not available: ${cap}`,
          severity: 'critical',
        });
      }
    }

    // Check steps have required fields
    for (const step of plan.steps) {
      if (!step.action || step.action.trim() === '') {
        errors.push({
          code: 'EMPTY_STEP',
          message: `Step ${step.order} has no action`,
          severity: 'high',
          stepId: step.id,
        });
      }
    }

    // Check for circular dependencies
    const cycleError = this.detectCycle(plan.steps);
    if (cycleError) {
      errors.push(cycleError);
    }

    // Check assumptions
    const criticalAssumptions = plan.assumptions.filter(
      (a) => a.impactIfWrong === 'critical' && a.confidence < 0.5
    );
    for (const assumption of criticalAssumptions) {
      warnings.push({
        code: 'LOW_CONFIDENCE_CRITICAL_ASSUMPTION',
        message: `Critical assumption has low confidence: ${assumption.statement}`,
      });
    }

    // Check predictions are in valid range
    if (plan.predictedSuccess < 0 || plan.predictedSuccess > 1) {
      errors.push({
        code: 'INVALID_PREDICTION',
        message: 'predictedSuccess must be between 0 and 1',
        severity: 'high',
      });
    }

    if (plan.predictedRisk < 0 || plan.predictedRisk > 1) {
      errors.push({
        code: 'INVALID_PREDICTION',
        message: 'predictedRisk must be between 0 and 1',
        severity: 'high',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple plans
   */
  validateAll(
    plans: CognitivePlan[],
    availableCapabilities: string[],
    constraints: WorldConstraint[] = []
  ): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    for (const plan of plans) {
      results.set(plan.id, this.validate(plan, availableCapabilities, constraints));
    }
    return results;
  }

  /**
   * Register a custom validation check
   */
  registerCheck(
    name: string,
    check: (plan: CognitivePlan, constraints: WorldConstraint[]) => ValidationError | ValidationWarning | null
  ): void {
    this.registeredChecks.push({ name, check });
  }

  // -----------------------------------------------------------------------
  // Built-in checks
  // -----------------------------------------------------------------------
  private registerBuiltinChecks(): void {
    // Check plan has steps
    this.registeredChecks.push({
      name: 'has-steps',
      check: (plan) => {
        if (plan.steps.length === 0) {
          return {
            code: 'NO_STEPS',
            message: 'Plan has no steps',
            severity: 'critical',
          };
        }
        return null;
      },
    });

    // Check plan has a goal
    this.registeredChecks.push({
      name: 'has-goal',
      check: (plan) => {
        if (!plan.goal || plan.goal.trim() === '') {
          return {
            code: 'NO_GOAL',
            message: 'Plan has no goal',
            severity: 'critical',
          };
        }
        return null;
      },
    });

    // Check predictions are reasonable
    this.registeredChecks.push({
      name: 'reasonable-predictions',
      check: (plan) => {
        if (plan.predictedRisk > 0.9) {
          return {
            code: 'HIGH_RISK',
            message: `Plan risk is very high: ${plan.predictedRisk}`,
          };
        }
        if (plan.predictedSuccess < 0.1) {
          return {
            code: 'LOW_SUCCESS',
            message: `Predicted success is very low: ${plan.predictedSuccess}`,
          };
        }
        return null;
      },
    });

    // Check capability requirements are valid tool IDs
    this.registeredChecks.push({
      name: 'valid-capability-ids',
      check: (plan) => {
        for (const cap of plan.requiredCapabilities) {
          if (!cap.includes('.') || cap.includes(' ')) {
            return {
              code: 'INVALID_CAPABILITY_ID',
              message: `Capability ID looks invalid: ${cap}`,
            };
          }
        }
        return null;
      },
    });
  }

  // -----------------------------------------------------------------------
  // Cycle detection
  // -----------------------------------------------------------------------
  private detectCycle(steps: PlanStep[]): ValidationError | null {
    const graph = new Map<string, string[]>();
    for (const step of steps) {
      graph.set(step.id, step.dependsOn);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (stack.has(node)) return true; // cycle found
      if (visited.has(node)) return false;

      visited.add(node);
      stack.add(node);

      const deps = graph.get(node) ?? [];
      for (const dep of deps) {
        if (dfs(dep)) return true;
      }

      stack.delete(node);
      return false;
    };

    for (const step of steps) {
      if (dfs(step.id)) {
        return {
          code: 'CYCLIC_DEPENDENCY',
          message: `Circular dependency detected involving step: ${step.id}`,
          severity: 'critical',
        };
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createPlanValidator(): PlanValidator {
  return new PlanValidator();
}
