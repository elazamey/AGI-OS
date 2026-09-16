// ============================================================================
// AGI OS - Core Types
// Atomic Kernel: Entity, Event, State, Result, Evidence, Decision
// ============================================================================

// ---------------------------------------------------------------------------
// Provenance - Track where something came from
// ---------------------------------------------------------------------------
export interface Provenance {
  source: string;
  version: string;
  timestamp: Date;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Entity - Base unit of the system
// ---------------------------------------------------------------------------
export interface Entity {
  id: string;
  type: EntityType;
  ownerId: string;
  projectId: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string;
  provenance: Provenance;
  metadata: Record<string, unknown>;
}

export type EntityType =
  | 'goal'
  | 'task'
  | 'plan'
  | 'mission'
  | 'event'
  | 'evidence'
  | 'memory'
  | 'skill'
  | 'policy'
  | 'tool'
  | 'decision'
  | 'result'
  | 'world_state'
  | 'entity';

// ---------------------------------------------------------------------------
// Event - Something that happened
// ---------------------------------------------------------------------------
export interface Event {
  id: string;
  type: EventType;
  timestamp: Date;
  entityId: string;
  stateRevision: string;
  data: Record<string, unknown>;
  evidence?: Evidence;
  metadata?: Record<string, unknown>;
}

export type EventType =
  // Goal events
  | 'goal.created'
  | 'goal.updated'
  | 'goal.completed'
  | 'goal.failed'
  | 'goal.cancelled'
  // Mission events
  | 'mission.created'
  | 'mission.planning'
  | 'mission.simulating'
  | 'mission.waiting_approval'
  | 'mission.executing'
  | 'mission.verifying'
  | 'mission.reflecting'
  | 'mission.completed'
  | 'mission.failed'
  | 'mission.blocked'
  // Task events
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.blocked'
  // Plan events
  | 'plan.created'
  | 'plan.approved'
  | 'plan.rejected'
  | 'plan.executed'
  // Tool events
  | 'tool.invoked'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'tool.blocked'
  // Memory events
  | 'memory.stored'
  | 'memory.retrieved'
  | 'memory.updated'
  | 'memory.deleted'
  // Evidence events
  | 'evidence.captured'
  | 'evidence.verified'
  // Decision events
  | 'decision.made'
  | 'decision.approved'
  | 'decision.rejected'
  // Reflection events
  | 'reflection.analyzed'
  | 'reflection.lesson_generated'
  | 'reflection.lesson_validated'
  // System events
  | 'system.started'
  | 'system.stopped'
  | 'system.error'
  | 'system.state_changed';

// ---------------------------------------------------------------------------
// State - System state at a point in time
// ---------------------------------------------------------------------------
export interface State {
  revision: string;
  timestamp: Date;
  data: Record<string, unknown>;
  parentRevision?: string;
  checksum: string;
}

export interface StateRevision {
  from: string;
  to: string;
  timestamp: Date;
  delta: Record<string, unknown>;
  eventId: string;
}

// ---------------------------------------------------------------------------
// Evidence - Proof that something happened
// ---------------------------------------------------------------------------
export interface Evidence {
  id: string;
  operation: string;
  command?: string;
  args?: string[];
  exitCode?: number;
  stdout?: string;
  stdoutHash?: string;
  stderr?: string;
  stderrHash?: string;
  timestamp: Date;
  stateRevision: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Result - Outcome of an operation
// ---------------------------------------------------------------------------
export interface Result {
  id: string;
  success: boolean;
  data?: unknown;
  error?: ErrorInfo;
  evidence?: Evidence;
  timestamp: Date;
  duration: number;
}

export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string;
  cause?: ErrorInfo;
}

// ---------------------------------------------------------------------------
// Decision - A choice made by the system
// ---------------------------------------------------------------------------
export interface Decision {
  id: string;
  type: DecisionType;
  context: string;
  options: DecisionOption[];
  selected: string;
  reasoning: string;
  confidence: number;
  evidence?: Evidence;
  timestamp: Date;
  stateRevision: string;
}

export type DecisionType =
  | 'tool_selection'
  | 'plan_selection'
  | 'strategy_selection'
  | 'resource_allocation'
  | 'risk_assessment'
  | 'approval';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  risk: number;
  confidence: number;
  predictedOutcome: string;
}

// ---------------------------------------------------------------------------
// Capability - What the system can do
// ---------------------------------------------------------------------------
export interface Capability {
  id: string;
  name: string;
  description: string;
  tools: string[];
  risk: RiskLevel;
  requiresApproval: boolean;
  permissions: Permission[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy - Rules that govern behavior
// ---------------------------------------------------------------------------
export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number;
}

export interface PolicyRule {
  condition: string;
  action: 'allow' | 'deny' | 'require_approval';
  scope?: string;
  risk?: RiskLevel;
}

// ---------------------------------------------------------------------------
// Metric - Quantitative measurement
// ---------------------------------------------------------------------------
export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export interface KernelConfig {
  projectId: string;
  ownerId: string;
  maxEventsPerState: number;
  enableEvidence: boolean;
  enableAudit: boolean;
  storagePath: string;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------
export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  projectId: 'default',
  ownerId: 'system',
  maxEventsPerState: 1000,
  enableEvidence: true,
  enableAudit: true,
  storagePath: './data'
};
