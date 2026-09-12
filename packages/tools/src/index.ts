// ============================================================================
// AGI OS - Tools Package
// Tool System - Governance, capabilities, and safe execution
// ============================================================================

// Types
export type {
  ToolRisk,
  ToolCategory,
  ToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolError,
  ToolErrorCode,
  Capability,
  CapabilityScope,
  ScopeType,
  ScopeCondition,
  ConditionOperator,
  Policy,
  PolicyRule,
  PolicyEffect,
  PolicyCondition,
  PolicyDecision,
  Authorization,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalResolution,
  ToolHandler,
  ToolContext,
  ValidationResult,
  ToolEventType,
  ToolEvent,
  ToolConfig
} from './types.js';

export {
  DEFAULT_TOOL_CONFIG,
  matchesScope,
  validateToolDefinition,
  validateCapability,
  validatePolicy
} from './types.js';

// Tool Registry
export {
  ToolRegistry,
  createToolRegistry,
  FILESYSTEM_READ_TOOL,
  FILESYSTEM_LIST_TOOL,
  GIT_STATUS_TOOL,
  GIT_LOG_TOOL,
  GIT_DIFF_TOOL,
  MISSION_INSPECT_TOOL,
  FILESYSTEM_WRITE_TOOL,
  GIT_COMMIT_TOOL,
  TERMINAL_EXECUTE_TOOL
} from './tool-registry.js';

export type { ToolRegistryEntry } from './tool-registry.js';

// Capability Registry
export {
  CapabilityRegistry,
  createCapabilityRegistry,
  FILESYSTEM_READ_CAPABILITY,
  FILESYSTEM_LIST_CAPABILITY,
  GIT_READ_CAPABILITY,
  MISSION_READ_CAPABILITY,
  FILESYSTEM_WRITE_CAPABILITY,
  GIT_WRITE_CAPABILITY,
  TERMINAL_EXECUTE_CAPABILITY
} from './capability.js';

// Policy Engine
export {
  PolicyEngine,
  createPolicyEngine,
  READ_ONLY_POLICY,
  WRITE_REQUIRES_APPROVAL_POLICY,
  DANGEROUS_PATHS_DENY_POLICY
} from './policy.js';

// Authorization
export {
  AuthorizationManager,
  createAuthorizationManager
} from './authorization.js';

// Approval Gate
export {
  ApprovalGate,
  createApprovalGate
} from './approval.js';

// Tool Executor
export {
  ToolExecutor,
  createToolExecutor,
  ToolRequestBuilder,
  createToolRequest
} from './executor.js';
