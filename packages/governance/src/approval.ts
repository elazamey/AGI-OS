// ============================================================================
// AGI OS - Approval Manager
// Manages pending approval requests with timeout
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { ActionIntent, ApprovalRequest, RiskAssessment, GovernanceConfig } from './types.js';
import { PolicyDecision, ApprovalStatus } from './types.js';

// ---------------------------------------------------------------------------
// ApprovalManager — handles approval workflow
// ---------------------------------------------------------------------------
export class ApprovalManager {
  private pending: Map<string, ApprovalRequest> = new Map();
  private resolved: ApprovalRequest[] = [];
  private config: GovernanceConfig;

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = {
      autoApproveBelow: 2,    // RiskLevel.MEDIUM
      requireApprovalAbove: 2,
      blockAbove: 4,          // RiskLevel.CRITICAL
      approvalTimeoutMs: 300000, // 5 minutes
      maxPendingApprovals: 50,
      ...config,
    };
  }

  /**
   * Create an approval request
   */
  requestApproval(params: {
    intent: ActionIntent;
    riskAssessment: RiskAssessment;
    decision: PolicyDecision;
    reason: string;
  }): ApprovalRequest {
    const ts = now().toISOString();
    const expiresAt = new Date(Date.now() + this.config.approvalTimeoutMs).toISOString();

    const request: ApprovalRequest = {
      id: generateId(),
      intent: params.intent,
      riskAssessment: params.riskAssessment,
      decision: params.decision,
      reason: params.reason,
      status: 'pending',
      requestedAt: ts,
      resolvedAt: null,
      resolvedBy: null,
      expiresAt,
    };

    this.pending.set(request.id, request);
    return request;
  }

  /**
   * Approve a pending request
   */
  approve(requestId: string, resolvedBy: string): ApprovalRequest | undefined {
    const request = this.pending.get(requestId);
    if (!request) return undefined;

    request.status = 'approved';
    request.resolvedAt = now().toISOString();
    request.resolvedBy = resolvedBy;

    this.pending.delete(requestId);
    this.resolved.push(request);
    return request;
  }

  /**
   * Deny a pending request
   */
  deny(requestId: string, resolvedBy: string): ApprovalRequest | undefined {
    const request = this.pending.get(requestId);
    if (!request) return undefined;

    request.status = 'denied';
    request.resolvedAt = now().toISOString();
    request.resolvedBy = resolvedBy;

    this.pending.delete(requestId);
    this.resolved.push(request);
    return request;
  }

  /**
   * Check for expired requests and mark them
   */
  checkExpired(): ApprovalRequest[] {
    const nowMs = Date.now();
    const expired: ApprovalRequest[] = [];

    for (const [id, request] of this.pending) {
      if (new Date(request.expiresAt).getTime() < nowMs) {
        request.status = 'expired';
        request.resolvedAt = now().toISOString();
        this.pending.delete(id);
        this.resolved.push(request);
        expired.push(request);
      }
    }

    return expired;
  }

  /**
   * Get pending requests
   */
  getPending(): ApprovalRequest[] {
    this.checkExpired();
    return [...this.pending.values()];
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    this.checkExpired();
    return this.pending.size;
  }

  /**
   * Get resolved requests
   */
  getResolved(): ApprovalRequest[] {
    return [...this.resolved];
  }

  /**
   * Get request by ID
   */
  getRequest(id: string): ApprovalRequest | undefined {
    return this.pending.get(id) ?? this.resolved.find((r) => r.id === id);
  }

  /**
   * Get requests for an intent
   */
  getRequestsForIntent(intentId: string): ApprovalRequest[] {
    return this.resolved.filter((r) => r.intent.id === intentId);
  }

  /**
   * Check if at max capacity
   */
  isAtCapacity(): boolean {
    return this.pending.size >= this.config.maxPendingApprovals;
  }

  /**
   * Get config
   */
  getConfig(): GovernanceConfig {
    return { ...this.config };
  }

  /**
   * Reset
   */
  reset(): void {
    this.pending.clear();
    this.resolved = [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createApprovalManager(config?: Partial<GovernanceConfig>): ApprovalManager {
  return new ApprovalManager(config);
}
