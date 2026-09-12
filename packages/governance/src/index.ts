// ============================================================================
// AGI OS - Governance Package
// Policy engine, risk assessment, approval gates, audit trail
// ============================================================================

// Types
export {
  RiskLevel,
  PolicyDecision,
} from './types.js';

export type {
  ActionIntent,
  PolicyRule,
  PolicyCondition,
  RiskAssessment,
  RiskFactor,
  AuditRecord,
  ApprovalRequest,
  ApprovalStatus,
  GovernanceConfig,
  GateResult,
} from './types.js';

// Risk Evaluator
export { RiskEvaluator, createRiskEvaluator } from './risk.js';

// Policy Engine
export { PolicyEngine, createPolicyEngine } from './policy.js';

// Audit Ledger
export { AuditLedger, createAuditLedger } from './audit.js';

// Approval Manager
export { ApprovalManager, createApprovalManager } from './approval.js';

// Governance Gateway
export { GovernanceGateway, createGovernanceGateway } from './governance-core.js';
