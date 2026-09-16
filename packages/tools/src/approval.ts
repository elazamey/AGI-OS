// ============================================================================
// AGI OS - Approval Gate
// Human-in-the-loop approval for risky operations
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  ApprovalRequest,
  ApprovalResolution,
  ToolRisk,
  ToolEventType,
  ToolEvent
} from './types.js';

// ---------------------------------------------------------------------------
// Approval Gate
// ---------------------------------------------------------------------------
export class ApprovalGate {
  private requests: Map<string, ApprovalRequest> = new Map();
  private events: ToolEvent[] = [];
  private autoApprove: boolean;
  private autoApproveRiskLevels: ToolRisk[];

  constructor(params: {
    autoApprove?: boolean;
    autoApproveRiskLevels?: ToolRisk[];
  } = {}) {
    this.autoApprove = params.autoApprove ?? false;
    this.autoApproveRiskLevels = params.autoApproveRiskLevels ?? ['none', 'low'];
  }

  /**
   * Request approval
   */
  requestApproval(params: {
    toolId: string;
    missionId: string;
    taskId?: string;
    input: Record<string, unknown>;
    risk: ToolRisk;
    reason: string;
  }): ApprovalRequest {
    const id = generateId();
    const request: ApprovalRequest = {
      id,
      toolId: params.toolId,
      missionId: params.missionId,
      taskId: params.taskId,
      input: params.input,
      risk: params.risk,
      reason: params.reason,
      requestedAt: now(),
      status: 'pending'
    };

    this.requests.set(id, request);
    this.recordEvent('approval.requested', {
      approvalId: id,
      toolId: params.toolId,
      missionId: params.missionId,
      risk: params.risk
    });

    // Auto-approve if configured
    if (this.autoApprove && this.autoApproveRiskLevels.includes(params.risk)) {
      this.resolve(id, {
        approved: true,
        reason: 'Auto-approved based on risk level'
      });
    }

    return request;
  }

  /**
   * Resolve an approval request
   */
  resolve(
    requestId: string,
    resolution: ApprovalResolution
  ): ApprovalRequest | undefined {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') return undefined;

    request.status = resolution.approved ? 'approved' : 'denied';
    request.resolvedAt = now();
    request.resolution = resolution;

    const eventType = resolution.approved
      ? 'approval.approved'
      : 'approval.denied';

    this.recordEvent(eventType, {
      approvalId: requestId,
      toolId: request.toolId,
      missionId: request.missionId,
      approved: resolution.approved,
      reason: resolution.reason
    });

    return request;
  }

  /**
   * Approve a request
   */
  approve(requestId: string, reason?: string): ApprovalRequest | undefined {
    return this.resolve(requestId, {
      approved: true,
      reason: reason || 'Approved'
    });
  }

  /**
   * Deny a request
   */
  deny(requestId: string, reason?: string): ApprovalRequest | undefined {
    return this.resolve(requestId, {
      approved: false,
      reason: reason || 'Denied'
    });
  }

  /**
   * Check if a request is approved
   */
  isApproved(requestId: string): boolean {
    const request = this.requests.get(requestId);
    return request?.status === 'approved';
  }

  /**
   * Check if a request is denied
   */
  isDenied(requestId: string): boolean {
    const request = this.requests.get(requestId);
    return request?.status === 'denied';
  }

  /**
   * Check if a request is pending
   */
  isPending(requestId: string): boolean {
    const request = this.requests.get(requestId);
    return request?.status === 'pending';
  }

  /**
   * Get a request
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    const request = this.requests.get(requestId);
    return request ? { ...request } : undefined;
  }

  /**
   * Get all requests
   */
  getAllRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values()).map((r) => ({ ...r }));
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return this.getAllRequests().filter((r) => r.status === 'pending');
  }

  /**
   * Get requests for a mission
   */
  getRequestsForMission(missionId: string): ApprovalRequest[] {
    return this.getAllRequests().filter((r) => r.missionId === missionId);
  }

  /**
   * Get requests for a tool
   */
  getRequestsForTool(toolId: string): ApprovalRequest[] {
    return this.getAllRequests().filter((r) => r.toolId === toolId);
  }

  /**
   * Expire old requests
   */
  expireOldRequests(maxAge: number): number {
    let count = 0;
    const cutoff = new Date(Date.now() - maxAge);

    for (const request of this.requests.values()) {
      if (request.status === 'pending' && request.requestedAt < cutoff) {
        request.status = 'expired';
        request.resolvedAt = now();
        request.resolution = {
          approved: false,
          reason: 'Request expired'
        };
        count++;
      }
    }

    return count;
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    denied: number;
    expired: number;
  } {
    const all = this.getAllRequests();
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      approved: all.filter((r) => r.status === 'approved').length,
      denied: all.filter((r) => r.status === 'denied').length,
      expired: all.filter((r) => r.status === 'expired').length
    };
  }

  /**
   * Get events
   */
  getEvents(): ToolEvent[] {
    return [...this.events];
  }

  /**
   * Clear all requests
   */
  clear(): void {
    this.requests.clear();
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
// Approval Gate Factory
// ---------------------------------------------------------------------------
export function createApprovalGate(params?: {
  autoApprove?: boolean;
  autoApproveRiskLevels?: ToolRisk[];
}): ApprovalGate {
  return new ApprovalGate(params);
}
