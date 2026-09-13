export interface AgentTask {
  agentId: string;
  taskId: string;
}

export interface CoordinationResult {
  assignments: Record<string, string[]>;
  duplicateWork: string[];
  unassignedTasks: string[];
}

export interface ConflictResult {
  agents: string[];
  target: string;
  action: string;
  severity: "low" | "medium" | "high";
}

export interface SwarmCollapseResult {
  healthy: string[];
  failed: string[];
  needsReallocation: boolean;
}

export interface ParallelismResult {
  conflicts: string[];
  safe: boolean;
  raceConditions: string[];
}

export interface DelegationResult {
  allowed: string[];
  denied: string[];
  escalated: boolean;
}
