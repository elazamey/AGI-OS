// ============================================================================
// AGI OS - Policy Engine
// Deterministic policy evaluation
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  Policy,
  PolicyRule,
  PolicyEffect,
  PolicyCondition,
  PolicyDecision,
  ToolEventType,
  ToolEvent,
  ConditionOperator
} from './types.js';
import { validatePolicy } from './types.js';

// ---------------------------------------------------------------------------
// Policy Engine
// ---------------------------------------------------------------------------
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private events: ToolEvent[] = [];

  /**
   * Add a policy
   */
  addPolicy(policy: Policy): void {
    if (!validatePolicy(policy)) {
      throw new Error('Invalid policy');
    }

    this.policies.set(policy.id, { ...policy });
    this.recordEvent('policy.created', { policyId: policy.id });
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    this.policies.delete(policyId);
    this.recordEvent('policy.deleted', { policyId });
    return true;
  }

  /**
   * Enable a policy
   */
  enablePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;
    policy.enabled = true;
    return true;
  }

  /**
   * Disable a policy
   */
  disablePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;
    policy.enabled = false;
    return true;
  }

  /**
   * Get a policy
   */
  getPolicy(policyId: string): Policy | undefined {
    const policy = this.policies.get(policyId);
    return policy ? { ...policy } : undefined;
  }

  /**
   * Get all policies
   */
  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values()).map((p) => ({ ...p }));
  }

  /**
   * Get enabled policies sorted by priority
   */
  getEnabledPolicies(): Policy[] {
    return this.getAllPolicies()
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a request against all policies
   */
  evaluate(
    toolId: string,
    input: Record<string, unknown>,
    context: Record<string, unknown> = {}
  ): PolicyDecision {
    const enabledPolicies = this.getEnabledPolicies();
    const matchedRules: string[] = [];
    let finalEffect: PolicyEffect | null = null;
    let finalReason = 'No matching policy';
    let finalPolicyId = '';

    for (const policy of enabledPolicies) {
      for (const rule of policy.rules) {
        if (this.evaluateRule(rule, toolId, input, context)) {
          matchedRules.push(rule.id);

          const currentEffect = finalEffect as string;

          // Priority: deny > approval_required > allow
          if (rule.effect === 'deny') {
            finalEffect = 'deny';
            finalReason = rule.description;
            finalPolicyId = policy.id;
            break;
          } else if (rule.effect === 'approval_required') {
            if (currentEffect !== 'deny') {
              finalEffect = 'approval_required';
              finalReason = rule.description;
              finalPolicyId = policy.id;
            }
          } else if (rule.effect === 'allow') {
            if (currentEffect !== 'approval_required' && currentEffect !== 'deny') {
              finalEffect = 'allow';
              finalReason = rule.description;
              finalPolicyId = policy.id;
            }
          }
        }
      }

      // If we found deny, stop looking
      if (finalEffect === 'deny') break;
    }

    return {
      allowed: finalEffect === 'allow',
      effect: finalEffect ?? 'deny',
      reason: finalReason,
      matchedRules,
      policyId: finalPolicyId,
      timestamp: now()
    };
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(
    rule: PolicyRule,
    toolId: string,
    input: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    return rule.conditions.every((condition) =>
      this.evaluateCondition(condition, toolId, input, context)
    );
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: PolicyCondition,
    toolId: string,
    input: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    const value = this.resolveField(condition.field, toolId, input, context);
    return this.evaluateOperator(condition.operator, value, condition.value);
  }

  /**
   * Resolve a field value from context
   */
  private resolveField(
    field: string,
    toolId: string,
    input: Record<string, unknown>,
    context: Record<string, unknown>
  ): unknown {
    if (field === 'toolId') return toolId;
    if (field.startsWith('input.')) {
      const key = field.slice(6);
      return input[key];
    }
    if (field.startsWith('context.')) {
      const key = field.slice(8);
      return context[key];
    }
    return context[field];
  }

  /**
   * Evaluate an operator
   */
  private evaluateOperator(
    operator: ConditionOperator,
    actual: unknown,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'not_contains':
        return !String(actual).includes(String(expected));
      case 'starts_with':
        return String(actual).startsWith(String(expected));
      case 'ends_with':
        return String(actual).endsWith(String(expected));
      case 'gt':
        return Number(actual) > Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'gte':
        return Number(actual) >= Number(expected);
      case 'lte':
        return Number(actual) <= Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  /**
   * Get events
   */
  getEvents(): ToolEvent[] {
    return [...this.events];
  }

  /**
   * Clear all policies
   */
  clear(): void {
    this.policies.clear();
    this.events = [];
  }

  /**
   * Record event
   */
  private recordEvent(type: ToolEventType, data: Record<string, unknown>): void {
    this.events.push({
      id: generateId(),
      type,
      timestamp: now(),
      data
    });
  }
}

// ---------------------------------------------------------------------------
// Policy Engine Factory
// ---------------------------------------------------------------------------
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}

// ---------------------------------------------------------------------------
// Built-in Policies
// ---------------------------------------------------------------------------

export const READ_ONLY_POLICY: Policy = {
  id: 'read-only',
  name: 'Read-Only Access',
  description: 'Allow read-only operations',
  priority: 100,
  enabled: true,
  rules: [
    {
      id: 'allow-read-filesystem',
      effect: 'allow',
      conditions: [
        { field: 'toolId', operator: 'in', value: ['filesystem.read', 'filesystem.list'] }
      ],
      description: 'Allow filesystem read operations'
    },
    {
      id: 'allow-read-git',
      effect: 'allow',
      conditions: [
        { field: 'toolId', operator: 'in', value: ['git.status', 'git.log', 'git.diff'] }
      ],
      description: 'Allow git read operations'
    },
    {
      id: 'allow-mission-inspect',
      effect: 'allow',
      conditions: [
        { field: 'toolId', operator: 'equals', value: 'mission.inspect' }
      ],
      description: 'Allow mission inspection'
    }
  ],
  metadata: {}
};

export const WRITE_REQUIRES_APPROVAL_POLICY: Policy = {
  id: 'write-requires-approval',
  name: 'Write Operations Require Approval',
  description: 'Write operations require human approval',
  priority: 200,
  enabled: true,
  rules: [
    {
      id: 'approval-filesystem-write',
      effect: 'approval_required',
      conditions: [
        { field: 'toolId', operator: 'equals', value: 'filesystem.write' }
      ],
      description: 'Filesystem write requires approval'
    },
    {
      id: 'approval-git-commit',
      effect: 'approval_required',
      conditions: [
        { field: 'toolId', operator: 'equals', value: 'git.commit' }
      ],
      description: 'Git commit requires approval'
    },
    {
      id: 'approval-terminal-execute',
      effect: 'approval_required',
      conditions: [
        { field: 'toolId', operator: 'equals', value: 'terminal.execute' }
      ],
      description: 'Terminal execution requires approval'
    }
  ],
  metadata: {}
};

export const DANGEROUS_PATHS_DENY_POLICY: Policy = {
  id: 'dangerous-paths-deny',
  name: 'Deny Dangerous Paths',
  description: 'Deny access to dangerous system paths',
  priority: 300,
  enabled: true,
  rules: [
    {
      id: 'deny-windows',
      effect: 'deny',
      conditions: [
        { field: 'input.path', operator: 'starts_with', value: 'C:\\Windows' }
      ],
      description: 'Deny access to Windows directory'
    },
    {
      id: 'deny-etc',
      effect: 'deny',
      conditions: [
        { field: 'input.path', operator: 'starts_with', value: '/etc' }
      ],
      description: 'Deny access to /etc directory'
    },
    {
      id: 'deny-secrets',
      effect: 'deny',
      conditions: [
        { field: 'input.path', operator: 'contains', value: '.env' }
      ],
      description: 'Deny access to .env files'
    }
  ],
  metadata: {}
};
