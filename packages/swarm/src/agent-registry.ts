import { generateId, now } from '@agi-os/kernel';
import type { AgentProfile, AgentRole, TrustLevel } from './types.js';

export class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();

  register(params: {
    id?: string;
    role: AgentRole;
    name: string;
    description?: string;
    capabilities?: string[];
    maxConcurrentTasks?: number;
    trustLevel?: TrustLevel;
  }): AgentProfile {
    const existing = [...this.agents.values()].find(a => a.role === params.role && a.name === params.name);
    if (existing) throw new Error(`Agent ${params.name} already registered for role ${params.role}`);

    const agent: AgentProfile = {
      id: params.id ?? generateId(),
      role: params.role,
      name: params.name,
      description: params.description ?? '',
      capabilities: params.capabilities ?? [],
      maxConcurrentTasks: params.maxConcurrentTasks ?? 1,
      trustLevel: params.trustLevel ?? 'standard',
      createdAt: now().toISOString(),
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  get(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  getByRole(role: AgentRole): AgentProfile[] {
    return [...this.agents.values()].filter(a => a.role === role);
  }

  getByCapability(capability: string): AgentProfile[] {
    return [...this.agents.values()].filter(a => a.capabilities.includes(capability));
  }

  getByTrustLevel(level: TrustLevel): AgentProfile[] {
    return [...this.agents.values()].filter(a => a.trustLevel === level);
  }

  getAll(): AgentProfile[] {
    return [...this.agents.values()];
  }

  count(): number {
    return this.agents.size;
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  clear(): void {
    this.agents.clear();
  }
}
