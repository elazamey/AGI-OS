// ============================================================================
// AGI OS - Policy Engine
// Evaluates intents against a strict constitution
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { ActionIntent, PolicyRule, PolicyCondition } from './types.js';
import { PolicyDecision } from './types.js';

// ---------------------------------------------------------------------------
// PolicyEngine — first-match-wins rule evaluation
// ---------------------------------------------------------------------------
export class PolicyEngine {
  private rules: PolicyRule[] = [];

  constructor() {
    this.initializeDefaultPolicies();
  }

  // ---- Default policies --------------------------------------------------

  private initializeDefaultPolicies(): void {
    // POL-001: Block access to sensitive system files
    this.addRule({
      id: 'POL-001',
      description: 'Block access to sensitive system files',
      condition: (i) => i.module === 'fs' && (
        i.target.includes('/etc/') ||
        i.target.includes('.env') ||
        i.target.includes('.ssh/') ||
        i.target.includes('id_rsa') ||
        i.target.includes('/proc/') ||
        i.target.includes('/sys/')
      ),
      enforce: PolicyDecision.BLOCK,
      priority: 100,
      enabled: true,
      tags: ['filesystem', 'security'],
    });

    // POL-002: Require approval for database modifications
    this.addRule({
      id: 'POL-002',
      description: 'Require approval for database modifications',
      condition: (i) => i.module === 'db' && ['insert', 'update', 'delete', 'drop', 'truncate'].includes(i.operation),
      enforce: PolicyDecision.REQUIRE_APPROVAL,
      priority: 90,
      enabled: true,
      tags: ['database', 'destructive'],
    });

    // POL-003: Block destructive git operations without approval
    this.addRule({
      id: 'POL-003',
      description: 'Block force-push and git reset --hard',
      condition: (i) => i.module === 'git' && (i.operation === 'force-push' || i.operation === 'reset-hard'),
      enforce: PolicyDecision.BLOCK,
      priority: 95,
      enabled: true,
      tags: ['git', 'destructive'],
    });

    // POL-004: Require approval for network calls to external APIs
    this.addRule({
      id: 'POL-004',
      description: 'Require approval for outbound network calls',
      condition: (i) => i.module === 'network' && i.operation === 'request',
      enforce: PolicyDecision.REQUIRE_APPROVAL,
      priority: 80,
      enabled: true,
      tags: ['network', 'external'],
    });

    // POL-005: Block execution of dangerous commands
    this.addRule({
      id: 'POL-005',
      description: 'Block execution of shell-dangerous commands',
      condition: (i) => {
        if (i.module !== 'exec' && i.module !== 'process') return false;
        const dangerous = ['rm -rf', 'mkfs', 'dd', 'format', ':(){', 'fork bomb', 'chmod 777', 'chown root', 'crontab', 'docker run --privileged', 'eval(', 'new Function'];
        const target = i.target.toLowerCase();
        return dangerous.some((d) => target.includes(d));
      },
      enforce: PolicyDecision.BLOCK,
      priority: 100,
      enabled: true,
      tags: ['exec', 'dangerous', 'security'],
    });

    // POL-006: Block writes outside workspace
    this.addRule({
      id: 'POL-006',
      description: 'Block filesystem writes outside workspace',
      condition: (i) => {
        if (i.module !== 'fs' || !['write', 'delete', 'modify'].includes(i.operation)) return false;
        const target = i.target;
        // Block absolute paths that aren't in common safe locations
        if (target.startsWith('/') && !target.startsWith('/tmp/') && !target.startsWith('/var/tmp/')) {
          return true;
        }
        return false;
      },
      enforce: PolicyDecision.BLOCK,
      priority: 85,
      enabled: true,
      tags: ['filesystem', 'sandbox'],
    });

    // POL-007: Allow all reads by default
    this.addRule({
      id: 'POL-007',
      description: 'Allow read operations by default',
      condition: (i) => i.operation === 'read' || i.operation === 'list' || i.operation === 'get',
      enforce: PolicyDecision.ALLOW,
      priority: 1,
      enabled: true,
      tags: ['default', 'read'],
    });
  }

  // ---- Rule management ---------------------------------------------------

  addRule(rule: Omit<PolicyRule, 'createdAt'>): PolicyRule {
    const fullRule: PolicyRule = {
      ...rule,
      createdAt: now().toISOString(),
    };
    this.rules.push(fullRule);
    this.rules.sort((a, b) => b.priority - a.priority);
    return fullRule;
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) rule.enabled = true;
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) rule.enabled = false;
  }

  getRule(ruleId: string): PolicyRule | undefined {
    return this.rules.find((r) => r.id === ruleId);
  }

  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  getEnabledRules(): PolicyRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  getRulesByTag(tag: string): PolicyRule[] {
    return this.rules.filter((r) => r.tags.includes(tag));
  }

  // ---- Evaluation --------------------------------------------------------

  evaluateIntent(intent: ActionIntent): { decision: PolicyDecision; matchedRuleId: string | null } {
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      try {
        if (rule.condition(intent)) {
          return { decision: rule.enforce, matchedRuleId: rule.id };
        }
      } catch {
        // If condition throws, skip this rule
        continue;
      }
    }

    return { decision: PolicyDecision.ALLOW, matchedRuleId: null };
  }

  /**
   * Check if an intent would be allowed (without side effects)
   */
  wouldAllow(intent: ActionIntent): boolean {
    const { decision } = this.evaluateIntent(intent);
    return decision === PolicyDecision.ALLOW;
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.rules = [];
    this.initializeDefaultPolicies();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}
