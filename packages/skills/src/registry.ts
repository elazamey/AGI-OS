import { generateId, now } from '@agi-os/kernel';
import type { SkillContract, SkillInstance, SkillExecutionRequest, SkillExecutionResult, SkillCategory, SkillStatus, EvidenceBundle } from './types.js';

export class SkillRegistry {
  private skills: Map<string, SkillInstance> = new Map();
  private executionHistory: SkillExecutionResult[] = [];

  register(contract: SkillContract): SkillInstance {
    if (this.skills.has(contract.id)) {
      throw new Error(`Skill ${contract.id} already registered`);
    }
    const instance: SkillInstance = {
      id: contract.id,
      contract,
      status: 'registered',
      registeredAt: now().toISOString(),
      totalExecutions: 0,
      successRate: 1.0,
    };
    this.skills.set(contract.id, instance);
    return instance;
  }

  unregister(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  enable(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill) skill.status = 'enabled';
  }

  disable(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (skill) skill.status = 'disabled';
  }

  getSkill(skillId: string): SkillInstance | undefined {
    return this.skills.get(skillId);
  }

  getSkillsByCategory(category: SkillCategory): SkillInstance[] {
    return Array.from(this.skills.values()).filter(s => s.contract.category === category);
  }

  getEnabledSkills(): SkillInstance[] {
    return Array.from(this.skills.values()).filter(s => s.status === 'enabled' || s.status === 'registered');
  }

  getSkillsRequiringApproval(): SkillInstance[] {
    return Array.from(this.skills.values()).filter(s => s.contract.requiresApproval);
  }

  getSkillsByRisk(risk: string): SkillInstance[] {
    return Array.from(this.skills.values()).filter(s => s.contract.risk === risk);
  }

  canExecute(skillId: string): { allowed: boolean; reason?: string } {
    const skill = this.skills.get(skillId);
    if (!skill) return { allowed: false, reason: 'Skill not found' };
    if (skill.status === 'disabled') return { allowed: false, reason: 'Skill disabled' };
    if (skill.status === 'blocked') return { allowed: false, reason: 'Skill blocked' };
    return { allowed: true };
  }

  recordExecution(result: SkillExecutionResult): void {
    this.executionHistory.push(result);
    const skill = this.skills.get(result.skillId);
    if (skill) {
      skill.totalExecutions++;
      skill.lastUsedAt = result.timestamp;
      const successes = this.executionHistory.filter(e => e.skillId === result.skillId && e.success).length;
      skill.successRate = successes / skill.totalExecutions;
    }
  }

  getExecutionHistory(skillId?: string): SkillExecutionResult[] {
    if (skillId) return this.executionHistory.filter(e => e.skillId === skillId);
    return [...this.executionHistory];
  }

  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    blocked: number;
    totalExecutions: number;
    averageSuccessRate: number;
  } {
    const all = Array.from(this.skills.values());
    return {
      total: all.length,
      enabled: all.filter(s => s.status === 'enabled' || s.status === 'registered').length,
      disabled: all.filter(s => s.status === 'disabled').length,
      blocked: all.filter(s => s.status === 'blocked').length,
      totalExecutions: this.executionHistory.length,
      averageSuccessRate: all.length > 0 ? all.reduce((sum, s) => sum + s.successRate, 0) / all.length : 0,
    };
  }

  clear(): void {
    this.skills.clear();
    this.executionHistory = [];
  }
}
