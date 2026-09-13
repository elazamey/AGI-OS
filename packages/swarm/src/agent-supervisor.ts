import { now } from '@agi-os/kernel';
import type { DelegationRequest } from './types.js';

export interface AgentHealth {
  agentId: string;
  activeTaskCount: number;
  completedTasks: number;
  failedTasks: number;
  lastActivityAt: string;
  status: 'idle' | 'busy' | 'overloaded' | 'unresponsive';
}

export interface SupervisorEvent {
  type: 'timeout' | 'overload' | 'failure' | 'recovery';
  agentId: string;
  delegationId?: string;
  message: string;
  timestamp: string;
}

export class AgentSupervisor {
  private health: Map<string, AgentHealth> = new Map();
  private events: SupervisorEvent[] = [];
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  registerAgent(agentId: string): void {
    this.health.set(agentId, {
      agentId,
      activeTaskCount: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastActivityAt: now().toISOString(),
      status: 'idle',
    });
  }

  unregisterAgent(agentId: string): void {
    this.health.delete(agentId);
  }

  taskStarted(agentId: string, _delegationId: string): void {
    const h = this.health.get(agentId);
    if (!h) return;
    h.activeTaskCount++;
    h.lastActivityAt = now().toISOString();
    h.status = h.activeTaskCount >= 3 ? 'overloaded' : 'busy';
  }

  taskCompleted(agentId: string, _delegationId: string): void {
    const h = this.health.get(agentId);
    if (!h) return;
    h.activeTaskCount = Math.max(0, h.activeTaskCount - 1);
    h.completedTasks++;
    h.lastActivityAt = now().toISOString();
    h.status = h.activeTaskCount === 0 ? 'idle' : 'busy';
  }

  taskFailed(agentId: string, delegationId: string, reason: string): void {
    const h = this.health.get(agentId);
    if (!h) return;
    h.activeTaskCount = Math.max(0, h.activeTaskCount - 1);
    h.failedTasks++;
    h.lastActivityAt = now().toISOString();
    h.status = h.activeTaskCount === 0 ? 'idle' : 'busy';

    this.events.push({
      type: 'failure',
      agentId,
      delegationId,
      message: reason,
      timestamp: now().toISOString(),
    });
  }

  checkTimeouts(activeDelegations: DelegationRequest[]): DelegationRequest[] {
    const overdue: DelegationRequest[] = [];
    const currentTime = new Date();

    for (const d of activeDelegations) {
      if (d.status !== 'in_progress') continue;
      const h = this.health.get(d.assignedTo);
      if (!h) continue;

      const lastActivity = new Date(h.lastActivityAt);
      const elapsed = currentTime.getTime() - lastActivity.getTime();

      if (elapsed > this.timeoutMs) {
        h.status = 'unresponsive';
        this.events.push({
          type: 'timeout',
          agentId: d.assignedTo,
          delegationId: d.id,
          message: `Task ${d.id} timed out after ${elapsed}ms`,
          timestamp: now().toISOString(),
        });
        overdue.push(d);
      }
    }
    return overdue;
  }

  getHealth(agentId: string): AgentHealth | undefined {
    return this.health.get(agentId);
  }

  getAllHealth(): AgentHealth[] {
    return [...this.health.values()];
  }

  getEvents(): SupervisorEvent[] {
    return [...this.events];
  }

  getEventsFor(agentId: string): SupervisorEvent[] {
    return this.events.filter(e => e.agentId === agentId);
  }

  clear(): void {
    this.health.clear();
    this.events = [];
  }
}
