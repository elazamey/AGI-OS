// ============================================================================
// AGI OS - Governance Gateway
// Intercepts actions → Risk → Policy → Audit → Approval
// ============================================================================

import type {
  ActionIntent,
  GovernanceConfig,
  GateResult,
  AuditRecord,
  ApprovalRequest,
} from './types.js';
import { PolicyDecision, RiskLevel } from './types.js';
import { RiskEvaluator } from './risk.js';
import { PolicyEngine } from './policy.js';
import { AuditLedger } from './audit.js';
import { ApprovalManager } from './approval.js';

// ---------------------------------------------------------------------------
// GovernanceGateway — the immune system for autonomous actions
// ---------------------------------------------------------------------------
export class GovernanceGateway {
  private risk: RiskEvaluator;
  private policy: PolicyEngine;
  private audit: AuditLedger;
  private approvals: ApprovalManager;
  private config: GovernanceConfig;

  constructor(params?: {
    risk?: RiskEvaluator;
    policy?: PolicyEngine;
    audit?: AuditLedger;
    approvals?: ApprovalManager;
    config?: Partial<GovernanceConfig>;
  }) {
    this.risk = params?.risk ?? new RiskEvaluator();
    this.policy = params?.policy ?? new PolicyEngine();
    this.audit = params?.audit ?? new AuditLedger();
    this.approvals = params?.approvals ?? new ApprovalManager(params?.config);
    this.config = {
      autoApproveBelow: 2,
      requireApprovalAbove: 2,
      blockAbove: 4,
      approvalTimeoutMs: 300000,
      maxPendingApprovals: 50,
      ...params?.config,
    };
  }

  /**
   * Core entry point — intercept an action intent through the governance pipeline
   */
  intercept(intent: ActionIntent): GateResult {
    // 1. Risk assessment
    const riskAssessment = this.risk.evaluate(intent);

    // 2. Policy evaluation
    const { decision: policyDecision, matchedRuleId } = this.policy.evaluateIntent(intent);

    // 3. Risk escalation override
    let finalDecision = policyDecision;
    let overridden = false;

    // CRITICAL risk + ALLOW → force REQUIRE_APPROVAL
    if (riskAssessment.riskLevel === RiskLevel.CRITICAL && policyDecision === PolicyDecision.ALLOW) {
      finalDecision = PolicyDecision.REQUIRE_APPROVAL;
      overridden = true;
    }

    // HIGH risk + ALLOW → force REQUIRE_APPROVAL
    if (riskAssessment.riskLevel === RiskLevel.HIGH && policyDecision === PolicyDecision.ALLOW) {
      finalDecision = PolicyDecision.REQUIRE_APPROVAL;
      overridden = true;
    }

    // BLOCK always wins (never override a block)
    if (policyDecision === PolicyDecision.BLOCK) {
      finalDecision = PolicyDecision.BLOCK;
    }

    // 4. Audit log
    const reason = overridden
      ? `Risk escalation: ${riskAssessment.reason}`
      : matchedRuleId
        ? `Rule ${matchedRuleId} matched`
        : 'No policy match — default allow';

    const auditRecord = this.audit.log({
      intent,
      riskAssessment,
      decision: finalDecision,
      matchedRuleId,
      reason,
      overridden,
    });

    // 5. Approval request (if needed)
    let approvalRequest: ApprovalRequest | undefined;
    if (finalDecision === PolicyDecision.REQUIRE_APPROVAL) {
      approvalRequest = this.approvals.requestApproval({
        intent,
        riskAssessment,
        decision: finalDecision,
        reason,
      });
    }

    return {
      decision: finalDecision,
      intent,
      riskAssessment,
      auditRecord,
      approvalRequest,
    };
  }

  /**
   * Check if an intent would be allowed (dry run — no audit log)
   */
  wouldAllow(intent: ActionIntent): boolean {
    const risk = this.risk.evaluate(intent);
    const { decision } = this.policy.evaluateIntent(intent);

    if (risk.riskLevel >= RiskLevel.HIGH && decision === PolicyDecision.ALLOW) {
      return false; // would be escalated
    }
    return decision === PolicyDecision.ALLOW;
  }

  /**
   * Approve a pending request
   */
  approve(requestId: string, resolvedBy: string): ApprovalRequest | undefined {
    return this.approvals.approve(requestId, resolvedBy);
  }

  /**
   * Deny a pending request
   */
  deny(requestId: string, resolvedBy: string): ApprovalRequest | undefined {
    return this.approvals.deny(requestId, resolvedBy);
  }

  /**
   * Get audit history
   */
  getAuditHistory(): AuditRecord[] {
    return this.audit.getHistory();
  }

  /**
   * Get audit stats
   */
  getAuditStats() {
    return this.audit.getStats();
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return this.approvals.getPending();
  }

  /**
   * Get risk evaluator
   */
  getRiskEvaluator(): RiskEvaluator {
    return this.risk;
  }

  /**
   * Get policy engine
   */
  getPolicyEngine(): PolicyEngine {
    return this.policy;
  }

  /**
   * Get audit ledger
   */
  getAuditLedger(): AuditLedger {
    return this.audit;
  }

  /**
   * Get approval manager
   */
  getApprovalManager(): ApprovalManager {
    return this.approvals;
  }

  /**
   * Reset everything
   */
  reset(): void {
    this.audit.reset();
    this.approvals.reset();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createGovernanceGateway(params?: {
  risk?: RiskEvaluator;
  policy?: PolicyEngine;
  audit?: AuditLedger;
  approvals?: ApprovalManager;
  config?: Partial<GovernanceConfig>;
}): GovernanceGateway {
  return new GovernanceGateway(params);
}
