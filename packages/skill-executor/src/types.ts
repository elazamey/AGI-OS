import type { Evidence } from '@agi-os/kernel';
import type { GovernanceGateway } from '@agi-os/governance';

export interface SkillExecutionRequest {
  missionId: string;
  taskId: string;
  skillId: string;
  input: Record<string, unknown>;
  requestedBy: string;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    /** Policy rule / approval reference when the refusal came from governance. */
    metadata?: { ruleId?: string | null; approvalRequestId?: string };
  };
  evidence: Evidence;
  duration: number;
  timestamp: string;
}

export interface SkillHandler {
  readonly skillId: string;
  readonly category: string;
  execute(input: Record<string, unknown>, context: SkillExecutionContext): Promise<unknown>;
}

export interface SkillExecutionContext {
  missionId: string;
  taskId: string;
  workingDir: string;
  timeout: number;
  governance: GovernanceGateway;
}
