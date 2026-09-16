export type RiskLevel = 'SAFE' | 'SENSITIVE' | 'CRITICAL';

export interface PolicyDecision {
  allowed: boolean;
  risk_level: RiskLevel;
  requires_approval: boolean;
  reason: string;
}

export interface PolicyRule {
  pattern: RegExp;
  risk_level: RiskLevel;
  description: string;
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];
  private approvalPending: Map<string, PolicyDecision> = new Map();

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    this.rules = [
      // SAFE operations
      { pattern: /^read\s/i, risk_level: 'SAFE', description: 'Read operation' },
      { pattern: /^list\s/i, risk_level: 'SAFE', description: 'List operation' },
      { pattern: /^search\s/i, risk_level: 'SAFE', description: 'Search operation' },
      { pattern: /^analyze\s/i, risk_level: 'SAFE', description: 'Analysis operation' },
      { pattern: /^cat\s/i, risk_level: 'SAFE', description: 'View file contents' },
      { pattern: /^ls\s/i, risk_level: 'SAFE', description: 'List directory' },
      { pattern: /^find\s/i, risk_level: 'SAFE', description: 'Find files' },
      { pattern: /^grep\s/i, risk_level: 'SAFE', description: 'Search in files' },

      // SENSITIVE operations
      { pattern: /^create\s/i, risk_level: 'SENSITIVE', description: 'Create operation' },
      { pattern: /^write\s/i, risk_level: 'SENSITIVE', description: 'Write operation' },
      { pattern: /^edit\s/i, risk_level: 'SENSITIVE', description: 'Edit operation' },
      { pattern: /^modify\s/i, risk_level: 'SENSITIVE', description: 'Modify operation' },
      { pattern: /^npm\s+test/i, risk_level: 'SENSITIVE', description: 'Run tests' },
      { pattern: /^pytest\s/i, risk_level: 'SENSITIVE', description: 'Run tests' },
      { pattern: /^npx\s/i, risk_level: 'SENSITIVE', description: 'Execute package' },

      // CRITICAL operations
      { pattern: /^delete\s/i, risk_level: 'CRITICAL', description: 'Delete operation' },
      { pattern: /^rm\s/i, risk_level: 'CRITICAL', description: 'Remove operation' },
      { pattern: /^rmdir\s/i, risk_level: 'CRITICAL', description: 'Remove directory' },
      { pattern: /^git\s+commit/i, risk_level: 'CRITICAL', description: 'Git commit' },
      { pattern: /^git\s+push/i, risk_level: 'CRITICAL', description: 'Git push' },
      { pattern: /^git\s+pull/i, risk_level: 'CRITICAL', description: 'Git pull' },
      { pattern: /^sudo\s/i, risk_level: 'CRITICAL', description: 'Superuser operation' },
      { pattern: /^chmod\s/i, risk_level: 'CRITICAL', description: 'Change permissions' },
      { pattern: /^kill\s/i, risk_level: 'CRITICAL', description: 'Kill process' },
    ];
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  evaluate(action: string): PolicyDecision {
    for (const rule of this.rules) {
      if (rule.pattern.test(action)) {
        return {
          allowed: true,
          risk_level: rule.risk_level,
          requires_approval: rule.risk_level === 'CRITICAL',
          reason: rule.description,
        };
      }
    }

    return {
      allowed: true,
      risk_level: 'SAFE',
      requires_approval: false,
      reason: 'No matching rule - defaulting to SAFE',
    };
  }

  requestApproval(decision: PolicyDecision): string {
    const id = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.approvalPending.set(id, decision);
    return id;
  }

  grantApproval(id: string): boolean {
    if (this.approvalPending.has(id)) {
      this.approvalPending.delete(id);
      return true;
    }
    return false;
  }

  denyApproval(id: string): boolean {
    return this.approvalPending.delete(id);
  }

  getPendingApprovals(): Array<{ id: string; decision: PolicyDecision }> {
    return Array.from(this.approvalPending.entries()).map(([id, decision]) => ({
      id,
      decision,
    }));
  }

  getRules(): PolicyRule[] {
    return [...this.rules];
  }
}
