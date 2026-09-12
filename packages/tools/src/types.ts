// ============================================================================
// AGI OS - Tool Types
// Types for Tool System with Governance
// ============================================================================

import type { Evidence } from '@agi-os/kernel';

// ---------------------------------------------------------------------------
// Tool Risk Level
// ---------------------------------------------------------------------------
export type ToolRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Tool Category
// ---------------------------------------------------------------------------
export type ToolCategory =
  | 'filesystem'
  | 'git'
  | 'terminal'
  | 'browser'
  | 'memory'
  | 'mission'
  | 'state'
  | 'evidence'
  | 'custom';

// ---------------------------------------------------------------------------
// Tool Definition - Declarative tool contract
// ---------------------------------------------------------------------------
export interface ToolDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: ToolCategory;
  capability: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  risk: ToolRisk;
  sideEffects: boolean;
  requiresApproval: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool Execution Request
// ---------------------------------------------------------------------------
export interface ToolExecutionRequest {
  id: string;
  toolId: string;
  missionId: string;
  taskId?: string;
  input: Record<string, unknown>;
  timestamp: Date;
  requester: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool Execution Result
// ---------------------------------------------------------------------------
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: ToolError;
  evidence?: Evidence;
  authorizationId?: string;
  duration: number;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Tool Error
// ---------------------------------------------------------------------------
export interface ToolError {
  code: ToolErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export type ToolErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'TOOL_UNAVAILABLE'
  | 'INPUT_VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'CAPABILITY_DENIED'
  | 'POLICY_DENIED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_DENIED'
  | 'AUTHORIZATION_EXPIRED'
  | 'AUTHORIZATION_DENIED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_ERROR';

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------
export interface Capability {
  id: string;
  name: string;
  description: string;
  toolId: string;
  scope: CapabilityScope;
  risk: ToolRisk;
  requiresApproval: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Capability Scope - Defines what the capability can access
// ---------------------------------------------------------------------------
export interface CapabilityScope {
  type: ScopeType;
  pattern: string;
  description: string;
  conditions?: ScopeCondition[];
}

export type ScopeType = 'exact' | 'prefix' | 'glob' | 'regex' | 'all';

export interface ScopeCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'not_in';

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------
export interface Policy {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  rules: PolicyRule[];
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy Rule
// ---------------------------------------------------------------------------
export interface PolicyRule {
  id: string;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  description: string;
}

export type PolicyEffect = 'allow' | 'deny' | 'approval_required';

export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Policy Decision
// ---------------------------------------------------------------------------
export interface PolicyDecision {
  allowed: boolean;
  effect: PolicyEffect;
  reason: string;
  matchedRules: string[];
  policyId: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------
export interface Authorization {
  id: string;
  capabilityId: string;
  toolId: string;
  scope: CapabilityScope;
  missionId: string;
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date;
  ttl: number;
  revoked: boolean;
  revokedAt?: Date;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Approval Request
// ---------------------------------------------------------------------------
export interface ApprovalRequest {
  id: string;
  toolId: string;
  missionId: string;
  taskId?: string;
  input: Record<string, unknown>;
  risk: ToolRisk;
  reason: string;
  requestedAt: Date;
  status: ApprovalStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: ApprovalResolution;
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface ApprovalResolution {
  approved: boolean;
  reason: string;
  conditions?: string[];
}

// ---------------------------------------------------------------------------
// Tool Handler - Actual implementation
// ---------------------------------------------------------------------------
export interface ToolHandler {
  execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult>;
  validate?(input: Record<string, unknown>): ValidationResult;
  cleanup?(): Promise<void>;
}

export interface ToolContext {
  missionId: string;
  taskId?: string;
  authorizationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Tool Event Types
// ---------------------------------------------------------------------------
export type ToolEventType =
  | 'tool.registered'
  | 'tool.unregistered'
  | 'tool.executing'
  | 'tool.executed'
  | 'tool.failed'
  | 'capability.granted'
  | 'capability.revoked'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'authorization.granted'
  | 'authorization.revoked'
  | 'authorization.expired'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.denied';

// ---------------------------------------------------------------------------
// Tool Event
// ---------------------------------------------------------------------------
export interface ToolEvent {
  id: string;
  type: ToolEventType;
  timestamp: Date;
  toolId?: string;
  capabilityId?: string;
  policyId?: string;
  authorizationId?: string;
  approvalId?: string;
  missionId?: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool Configuration
// ---------------------------------------------------------------------------
export interface ToolConfig {
  defaultTimeout: number;
  maxConcurrentExecutions: number;
  requireApprovalForCritical: boolean;
  auditEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  defaultTimeout: 30000,
  maxConcurrentExecutions: 5,
  requireApprovalForCritical: true,
  auditEnabled: true,
  rateLimitEnabled: false,
  rateLimitWindow: 60000,
  rateLimitMax: 100
};

// ---------------------------------------------------------------------------
// Scope Matching
// ---------------------------------------------------------------------------
export function matchesScope(
  scope: CapabilityScope,
  target: string
): boolean {
  switch (scope.type) {
    case 'exact':
      return scope.pattern === target;
    case 'prefix':
      return target.startsWith(scope.pattern);
    case 'glob':
      return matchGlob(scope.pattern, target);
    case 'regex':
      return new RegExp(scope.pattern).test(target);
    case 'all':
      return true;
    default:
      return false;
  }
}

function matchGlob(pattern: string, target: string): boolean {
  // Convert glob pattern to regex
  // * matches any characters except /
  // ** matches any characters including /
  // ? matches single character
  let regexStr = '';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches anything
        regexStr += '.*';
        i += 2;
        // Skip trailing slash if present
        if (pattern[i] === '/') i++;
      } else {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      regexStr += '[^/]';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }
  return new RegExp(`^${regexStr}$`).test(target);
}

// ---------------------------------------------------------------------------
// Tool Validators
// ---------------------------------------------------------------------------
export function validateToolDefinition(tool: unknown): tool is ToolDefinition {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.version === 'string' &&
    typeof t.description === 'string' &&
    typeof t.category === 'string' &&
    typeof t.capability === 'string' &&
    typeof t.risk === 'string' &&
    typeof t.sideEffects === 'boolean' &&
    typeof t.requiresApproval === 'boolean'
  );
}

export function validateCapability(cap: unknown): cap is Capability {
  if (typeof cap !== 'object' || cap === null) return false;
  const c = cap as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.toolId === 'string' &&
    typeof c.scope === 'object' &&
    c.scope !== null &&
    typeof c.risk === 'string' &&
    typeof c.enabled === 'boolean'
  );
}

export function validatePolicy(policy: unknown): policy is Policy {
  if (typeof policy !== 'object' || policy === null) return false;
  const p = policy as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.priority === 'number' &&
    typeof p.enabled === 'boolean' &&
    Array.isArray(p.rules)
  );
}
