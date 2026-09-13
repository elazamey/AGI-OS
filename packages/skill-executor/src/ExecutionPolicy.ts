import type { SkillContract } from '@agi-os/skills';

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
}

export class ExecutionPolicy {
  async check(skill: SkillContract, _missionId: string): Promise<PolicyCheckResult> {
    if (skill.risk === 'CRITICAL') {
      return {
        allowed: true,
        requiresApproval: true,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
    };
  }
}
