// ============================================================================
// AGI OS - Audit Ledger
// Immutable record of every governance evaluation
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { AuditRecord, ActionIntent, RiskAssessment } from './types.js';
import { PolicyDecision } from './types.js';

// ---------------------------------------------------------------------------
// AuditLedger — append-only audit trail
// ---------------------------------------------------------------------------
export class AuditLedger {
  private records: AuditRecord[] = [];

  /**
   * Log an audit record
   */
  log(params: {
    intent: ActionIntent;
    riskAssessment: RiskAssessment;
    decision: PolicyDecision;
    matchedRuleId: string | null;
    reason: string;
    overridden: boolean;
  }): AuditRecord {
    const record: AuditRecord = {
      id: generateId(),
      timestamp: now().toISOString(),
      intent: params.intent,
      riskAssessment: params.riskAssessment,
      decision: params.decision,
      matchedRuleId: params.matchedRuleId,
      reason: params.reason,
      overridden: params.overridden,
    };
    this.records.push(record);
    return record;
  }

  /**
   * Get all records
   */
  getHistory(): AuditRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific intent
   */
  getByIntentId(intentId: string): AuditRecord[] {
    return this.records.filter((r) => r.intent.id === intentId);
  }

  /**
   * Get records by decision type
   */
  getByDecision(decision: PolicyDecision): AuditRecord[] {
    return this.records.filter((r) => r.decision === decision);
  }

  /**
   * Get blocked actions
   */
  getBlocked(): AuditRecord[] {
    return this.getByDecision(PolicyDecision.BLOCK);
  }

  /**
   * Get actions requiring approval
   */
  getPendingApproval(): AuditRecord[] {
    return this.getByDecision(PolicyDecision.REQUIRE_APPROVAL);
  }

  /**
   * Get allowed actions
   */
  getAllowed(): AuditRecord[] {
    return this.getByDecision(PolicyDecision.ALLOW);
  }

  /**
   * Get overridden decisions (risk escalation changed the policy decision)
   */
  getOverridden(): AuditRecord[] {
    return this.records.filter((r) => r.overridden);
  }

  /**
   * Get recent records
   */
  getRecent(n: number): AuditRecord[] {
    return this.records.slice(-n);
  }

  /**
   * Get records in time range
   */
  getInRange(from: Date, to: Date): AuditRecord[] {
    return this.records.filter((r) => {
      const ts = new Date(r.timestamp);
      return ts >= from && ts <= to;
    });
  }

  /**
   * Get records by module
   */
  getByModule(module: string): AuditRecord[] {
    return this.records.filter((r) => r.intent.module === module);
  }

  /**
   * Get records by matched rule
   */
  getByRule(ruleId: string): AuditRecord[] {
    return this.records.filter((r) => r.matchedRuleId === ruleId);
  }

  /**
   * Total record count
   */
  count(): number {
    return this.records.length;
  }

  /**
   * Get stats summary
   */
  getStats(): {
    total: number;
    allowed: number;
    blocked: number;
    requireApproval: number;
    overridden: number;
    byModule: Record<string, number>;
    byRiskLevel: Record<number, number>;
  } {
    const byModule: Record<string, number> = {};
    const byRiskLevel: Record<number, number> = {};

    for (const r of this.records) {
      byModule[r.intent.module] = (byModule[r.intent.module] ?? 0) + 1;
      byRiskLevel[r.riskAssessment.riskLevel] = (byRiskLevel[r.riskAssessment.riskLevel] ?? 0) + 1;
    }

    return {
      total: this.records.length,
      allowed: this.getByDecision(PolicyDecision.ALLOW).length,
      blocked: this.getByDecision(PolicyDecision.BLOCK).length,
      requireApproval: this.getByDecision(PolicyDecision.REQUIRE_APPROVAL).length,
      overridden: this.getOverridden().length,
      byModule,
      byRiskLevel,
    };
  }

  /**
   * Reset audit trail
   */
  reset(): void {
    this.records = [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createAuditLedger(): AuditLedger {
  return new AuditLedger();
}
