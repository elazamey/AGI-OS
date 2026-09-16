export type AgentRole = 'researcher' | 'coder' | 'auditor' | 'planner' | 'custom';
export type TrustLevel = 'restricted' | 'standard' | 'privileged';
export type MessageType = 'task_delegation' | 'result' | 'question' | 'alert' | 'coordination';
export type DelegationStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'rejected';

export interface AgentProfile {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  trustLevel: TrustLevel;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: MessageType;
  payload: unknown;
  requiresGovernance: boolean;
  timestamp: string;
}

export interface DelegationRequest {
  id: string;
  parentMissionId: string;
  goal: string;
  assignedTo: string;
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  constraints: TaskConstraints;
  deadline?: string;
  status: DelegationStatus;
}

export interface TaskConstraints {
  maxDuration: number;
  maxCost: number;
  allowedModules: string[];
  requiresApproval: boolean;
}

export interface SwarmState {
  activeAgents: string[];
  activeDelegations: DelegationRequest[];
  messageQueue: AgentMessage[];
  completedTasks: string[];
  failedTasks: string[];
}

export interface SwarmConfig {
  maxAgents: number;
  maxConcurrentDelegations: number;
  delegationTimeoutMs: number;
  enableGovernanceIntercept: boolean;
  enableAuditLogging: boolean;
}
