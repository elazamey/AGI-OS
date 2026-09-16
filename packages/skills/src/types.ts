export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApprovalMode = 'AUTO' | 'ASK' | 'DENY';
export type VerificationLevel = 'BASIC' | 'STRICT' | 'PROOF';
export type SkillCategory = 'core' | 'browser' | 'research' | 'coding' | 'terminal' | 'filesystem' | 'git' | 'github' | 'documents' | 'spreadsheet' | 'pdf' | 'memory' | 'artifact' | 'connector' | 'security' | 'verification' | 'recovery' | 'swarm' | 'model-router';
export type SkillStatus = 'registered' | 'enabled' | 'disabled' | 'blocked';

export interface SkillContract {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  capabilities: string[];
  risk: RiskLevel;
  requiresApproval: boolean;
  requiresNetwork: boolean;
  requiresPersistence: boolean;
  allowedScopes: string[];
  timeoutMs: number;
  retryLimit: number;
  verification: {
    required: boolean;
    level: VerificationLevel;
  };
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface SkillInstance {
  id: string;
  contract: SkillContract;
  status: SkillStatus;
  registeredAt: string;
  lastUsedAt?: string;
  totalExecutions: number;
  successRate: number;
}

export interface SkillExecutionRequest {
  skillId: string;
  input: Record<string, unknown>;
  missionId: string;
  taskId: string;
  agentId: string;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  output: unknown;
  evidence?: EvidenceBundle;
  duration: number;
  timestamp: string;
}

export interface EvidenceBundle {
  id: string;
  skillId: string;
  action: string;
  result: string;
  verified: boolean;
  confidence: number;
  proof?: Record<string, unknown>;
  timestamp: string;
}

export interface MissionRuntimePolicy {
  maxSteps: number;
  timeoutMs: number;
  maxToolCalls: number;
  maxParallelTasks: number;
  retryLimit: number;
  approvalMode: ApprovalMode;
  verificationLevel: VerificationLevel;
  riskLevel: RiskLevel;
  evidenceRequired: boolean;
  checkpointInterval: number;
  rollbackOnFailure: boolean;
  persistenceRequired: boolean;
  networkPolicy: 'NONE' | 'ALLOWLIST' | 'OPEN';
  filesystemScope: string[];
  tokenBudget?: number;
  modelPolicy?: {
    primary: string;
    fallback: string[];
  };
}

export const DEFAULT_MISSION_POLICY: MissionRuntimePolicy = {
  maxSteps: 100,
  timeoutMs: 600000,
  maxToolCalls: 200,
  maxParallelTasks: 5,
  retryLimit: 3,
  approvalMode: 'ASK',
  verificationLevel: 'STRICT',
  riskLevel: 'MEDIUM',
  evidenceRequired: true,
  checkpointInterval: 5,
  rollbackOnFailure: true,
  persistenceRequired: true,
  networkPolicy: 'ALLOWLIST',
  filesystemScope: ['./workspace'],
};
