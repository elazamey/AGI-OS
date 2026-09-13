import { describe, it, expect, beforeEach } from 'vitest';
import { AgentSupervisor } from '../src/agent-supervisor.js';
import type { DelegationRequest } from '../src/types.js';

describe('AgentSupervisor', () => {
  let s: AgentSupervisor;
  beforeEach(() => { s = new AgentSupervisor(1000); });

  const del = (overrides?: Partial<DelegationRequest>): DelegationRequest => ({
    id: 'd1', parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k',
    priority: 'medium', constraints: { maxDuration: 5000, maxCost: 0, allowedModules: [], requiresApproval: false },
    status: 'in_progress', ...overrides,
  });

  it('registers agent', () => {
    s.registerAgent('a1');
    expect(s.getHealth('a1')).toBeDefined();
    expect(s.getHealth('a1')?.status).toBe('idle');
  });

  it('tracks task start', () => {
    s.registerAgent('a1');
    s.taskStarted('a1', 'd1');
    expect(s.getHealth('a1')?.activeTaskCount).toBe(1);
    expect(s.getHealth('a1')?.status).toBe('busy');
  });

  it('tracks task completion', () => {
    s.registerAgent('a1');
    s.taskStarted('a1', 'd1');
    s.taskCompleted('a1', 'd1');
    expect(s.getHealth('a1')?.completedTasks).toBe(1);
  });

  it('tracks task failure', () => {
    s.registerAgent('a1');
    s.taskStarted('a1', 'd1');
    s.taskFailed('a1', 'd1', 'err');
    expect(s.getHealth('a1')?.failedTasks).toBe(1);
    expect(s.getEvents().length).toBe(1);
  });

  it('detects overloaded', () => {
    s.registerAgent('a1');
    s.taskStarted('a1', 'd1');
    s.taskStarted('a1', 'd2');
    s.taskStarted('a1', 'd3');
    expect(s.getHealth('a1')?.status).toBe('overloaded');
  });

  it('detects timeouts', () => {
    s.registerAgent('a1');
    s.taskStarted('a1', 'd1');
    const health = s.getHealth('a1')!;
    health.lastActivityAt = new Date(Date.now() - 5000).toISOString();
    const overdue = s.checkTimeouts([del()]);
    expect(overdue.length).toBe(1);
    expect(s.getHealth('a1')?.status).toBe('unresponsive');
  });

  it('no timeout for idle', () => {
    s.registerAgent('a1');
    expect(s.checkTimeouts([]).length).toBe(0);
  });

  it('returns all health', () => {
    s.registerAgent('a1');
    s.registerAgent('a2');
    expect(s.getAllHealth().length).toBe(2);
  });

  it('gets events for agent', () => {
    s.registerAgent('a1');
    s.registerAgent('a2');
    s.taskStarted('a1', 'd1');
    s.taskFailed('a1', 'd1', 'err');
    s.taskStarted('a2', 'd2');
    expect(s.getEventsFor('a1').length).toBe(1);
  });

  it('unregisters', () => {
    s.registerAgent('a1');
    s.unregisterAgent('a1');
    expect(s.getHealth('a1')).toBeUndefined();
  });
});
