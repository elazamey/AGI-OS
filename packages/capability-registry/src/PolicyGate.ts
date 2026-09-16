// ═══════════════════════════════════════════════════════
// PolicyGate — Risk Classification & Approval Gating
// ═══════════════════════════════════════════════════════

import type { RepositoryCapability, RiskLevel, PolicyDecision } from './types';

export interface ExecutionContext {
  userApproved: boolean;
  riskOverride?: RiskLevel;
  reason?: string;
}

const RISK_HIERARCHY: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export class PolicyGate {
  private approvalLog: Array<{
    capabilityId: string;
    decision: PolicyDecision;
    timestamp: number;
    context: ExecutionContext;
  }> = [];

  evaluateExecutionPermission(cap: RepositoryCapability, context: ExecutionContext): boolean {
    const decision = this.evaluate(cap, context);
    return decision.allowed;
  }

  evaluate(cap: RepositoryCapability, context: ExecutionContext): PolicyDecision {
    const riskLevel = context.riskOverride || cap.policyRequirements.riskLevel;
    const capRequiresApproval = cap.policyRequirements.requiresApproval;
    const requiresApproval = capRequiresApproval || RISK_HIERARCHY[riskLevel] >= RISK_HIERARCHY['HIGH'];

    let decision: PolicyDecision;

    if (riskLevel === 'CRITICAL' && !context.userApproved) {
      decision = {
        allowed: false,
        requiresApproval: true,
        riskLevel,
        reason: `CRITICAL risk capability "${cap.id}" requires explicit user approval`,
      };
    } else if (requiresApproval && !context.userApproved) {
      decision = {
        allowed: false,
        requiresApproval: true,
        riskLevel,
        reason: `${riskLevel} risk capability "${cap.id}" requires approval before execution`,
      };
    } else if (cap.status === 'DOWN') {
      decision = {
        allowed: false,
        requiresApproval: false,
        riskLevel,
        reason: `Capability "${cap.id}" is currently DOWN`,
      };
    } else {
      decision = {
        allowed: true,
        requiresApproval: false,
        riskLevel,
        reason: `Capability "${cap.id}" approved (${riskLevel})`,
      };
    }

    this.approvalLog.push({
      capabilityId: cap.id,
      decision,
      timestamp: Date.now(),
      context,
    });

    return decision;
  }

  bulkEvaluate(caps: RepositoryCapability[], context: ExecutionContext): PolicyDecision[] {
    return caps.map(cap => this.evaluate(cap, context));
  }

  getApprovalLog(): typeof this.approvalLog { return [...this.approvalLog]; }

  getApprovalCount(): number { return this.approvalLog.length; }

  getApprovalRate(): number {
    if (this.approvalLog.length === 0) return 0;
    const approved = this.approvalLog.filter(e => e.decision.allowed).length;
    return Number(((approved / this.approvalLog.length) * 100).toFixed(2));
  }
}
