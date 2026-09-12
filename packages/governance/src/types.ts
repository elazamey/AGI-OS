// ============================================================================
// AGI OS - Governance Types
// Rigid boundaries, risk tiers, policy rules, audit structures
// ============================================================================

// ---------------------------------------------------------------------------
// Risk Level
// ---------------------------------------------------------------------------
export enum RiskLevel {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

// ---------------------------------------------------------------------------
// Policy Decision
// ---------------------------------------------------------------------------
export enum PolicyDecision {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
  REQUIRE_APPROVAL = 'REQUIRE_APPROVAL',
}

// ---------------------------------------------------------------------------
// Action Intent — what the system wants to do
// ---------------------------------------------------------------------------
export interface ActionIntent {
  id: string;
  module: string;       // e.g., 'fs', 'network', 'db', 'exec', 'git'
  operation: string;    // e.g., 'read', 'write', 'delete', 'execute', 'push'
  target: string;       // e.g., '/etc/passwd', 'https://api.xyz.com', 'main'
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy Rule
// ---------------------------------------------------------------------------
export type PolicyCondition = (intent: ActionIntent) => boolean;

export interface PolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  enforce: PolicyDecision;
  priority: number;       // higher = evaluated first
  enabled: boolean;
  tags: string[];         // e.g., ['filesystem', 'destructive']
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Risk Assessment
// ---------------------------------------------------------------------------
export interface RiskAssessment {
  intent: ActionIntent;
  riskLevel: RiskLevel;
  riskScore: number;      // 0-100
  factors: RiskFactor[];
  reason: string;
}

export interface RiskFactor {
  name: string;
  contribution: number;   // how much this factor adds to the score
  description: string;
}

// ---------------------------------------------------------------------------
// Audit Record
// ---------------------------------------------------------------------------
export interface AuditRecord {
  id: string;
  timestamp: string;
  intent: ActionIntent;
  riskAssessment: RiskAssessment;
  decision: PolicyDecision;
  matchedRuleId: string | null;
  reason: string;
  overridden: boolean;    // was the decision overridden by risk escalation?
}

// ---------------------------------------------------------------------------
// Approval Request
// ---------------------------------------------------------------------------
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface ApprovalRequest {
  id: string;
  intent: ActionIntent;
  riskAssessment: RiskAssessment;
  decision: PolicyDecision;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Governance Config
// ---------------------------------------------------------------------------
export interface GovernanceConfig {
  autoApproveBelow: RiskLevel;      // auto-approve actions below this risk level
  requireApprovalAbove: RiskLevel;  // require approval above this risk level
  blockAbove: RiskLevel;            // block actions above this risk level
  approvalTimeoutMs: number;        // how long before approval expires
  maxPendingApprovals: number;      // limit concurrent pending approvals
}

// ---------------------------------------------------------------------------
// Governance Gate Result
// ---------------------------------------------------------------------------
export interface GateResult {
  decision: PolicyDecision;
  intent: ActionIntent;
  riskAssessment: RiskAssessment;
  auditRecord: AuditRecord;
  approvalRequest?: ApprovalRequest;
}
