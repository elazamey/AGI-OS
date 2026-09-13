import { generateId } from '@agi-os/kernel';
import type { DelegationRequest, DelegationStatus, TaskConstraints } from './types.js';

export class DelegationManager {
  private delegations: Map<string, DelegationRequest> = new Map();

  create(params: {
    parentMissionId: string;
    goal: string;
    assignedTo: string;
    assignedBy: string;
    priority?: DelegationRequest['priority'];
    constraints?: Partial<TaskConstraints>;
    deadline?: string;
  }): DelegationRequest {
    const delegation: DelegationRequest = {
      id: generateId(),
      parentMissionId: params.parentMissionId,
      goal: params.goal,
      assignedTo: params.assignedTo,
      assignedBy: params.assignedBy,
      priority: params.priority ?? 'medium',
      constraints: {
        maxDuration: params.constraints?.maxDuration ?? 30000,
        maxCost: 0,
        allowedModules: params.constraints?.allowedModules ?? ['fs', 'exec', 'db'],
        requiresApproval: params.constraints?.requiresApproval ?? false,
      },
      deadline: params.deadline,
      status: 'pending',
    };
    this.delegations.set(delegation.id, delegation);
    return delegation;
  }

  accept(delegationId: string): DelegationRequest | undefined {
    const d = this.delegations.get(delegationId);
    if (!d || d.status !== 'pending') return undefined;
    d.status = 'accepted';
    return d;
  }

  start(delegationId: string): DelegationRequest | undefined {
    const d = this.delegations.get(delegationId);
    if (!d || d.status !== 'accepted') return undefined;
    d.status = 'in_progress';
    return d;
  }

  complete(delegationId: string): DelegationRequest | undefined {
    const d = this.delegations.get(delegationId);
    if (!d || d.status !== 'in_progress') return undefined;
    d.status = 'completed';
    return d;
  }

  fail(delegationId: string): DelegationRequest | undefined {
    const d = this.delegations.get(delegationId);
    if (!d || d.status !== 'in_progress') return undefined;
    d.status = 'failed';
    return d;
  }

  reject(delegationId: string): DelegationRequest | undefined {
    const d = this.delegations.get(delegationId);
    if (!d || d.status !== 'pending') return undefined;
    d.status = 'rejected';
    return d;
  }

  get(delegationId: string): DelegationRequest | undefined {
    return this.delegations.get(delegationId);
  }

  getByAgent(agentId: string): DelegationRequest[] {
    return [...this.delegations.values()].filter(d => d.assignedTo === agentId);
  }

  getByStatus(status: DelegationStatus): DelegationRequest[] {
    return [...this.delegations.values()].filter(d => d.status === status);
  }

  getByMission(missionId: string): DelegationRequest[] {
    return [...this.delegations.values()].filter(d => d.parentMissionId === missionId);
  }

  getActive(): DelegationRequest[] {
    return [...this.delegations.values()].filter(
      d => d.status === 'pending' || d.status === 'accepted' || d.status === 'in_progress'
    );
  }

  getAll(): DelegationRequest[] {
    return [...this.delegations.values()];
  }

  count(): number {
    return this.delegations.size;
  }

  isOverdue(delegationId: string): boolean {
    const d = this.delegations.get(delegationId);
    if (!d || !d.deadline) return false;
    return new Date(d.deadline) < new Date();
  }

  clear(): void {
    this.delegations.clear();
  }
}
