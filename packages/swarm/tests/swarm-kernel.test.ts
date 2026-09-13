import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmKernel, DefaultTaskDecomposer } from '../src/swarm-kernel.js';
import { GovernanceGateway } from '@agi-os/governance';

describe('SwarmKernel', () => {
  let kernel: SwarmKernel;
  beforeEach(() => { kernel = new SwarmKernel({ governance: new GovernanceGateway() }); });

  it('registers agents', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1' });
    expect(a.id).toBeDefined();
    expect(kernel.getRegistry().count()).toBe(1);
  });

  it('enforces max agents', () => {
    const k = new SwarmKernel({ config: { maxAgents: 2 } });
    k.registerAgent({ role: 'researcher', name: 'R1' });
    k.registerAgent({ role: 'coder', name: 'C1' });
    expect(() => k.registerAgent({ role: 'auditor', name: 'A1' })).toThrow();
  });

  it('unregisters agents', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1' });
    expect(kernel.unregisterAgent(a.id)).toBe(true);
    expect(kernel.getRegistry().count()).toBe(0);
  });

  it('decomposes research mission', () => {
    const m = kernel.decomposeMission('m1', 'Research the codebase');
    expect(m.decomposedTasks[0].requiredRole).toBe('researcher');
  });

  it('decomposes implementation mission', () => {
    const m = kernel.decomposeMission('m1', 'Build a REST API');
    expect(m.decomposedTasks[0].requiredRole).toBe('coder');
  });

  it('decomposes audit mission', () => {
    const m = kernel.decomposeMission('m1', 'Review the security');
    expect(m.decomposedTasks[0].requiredRole).toBe('auditor');
  });

  it('decomposes complex mission', () => {
    const m = kernel.decomposeMission('m1', 'Research, implement, and review the feature');
    expect(m.decomposedTasks.length).toBe(3);
  });

  it('creates default task', () => {
    const m = kernel.decomposeMission('m1', 'Do something');
    expect(m.decomposedTasks.length).toBe(1);
    expect(m.decomposedTasks[0].requiredRole).toBe('coder');
  });

  it('assigns task', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] });
    const m = kernel.decomposeMission('m1', 'Research');
    const d = kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    expect(d).toBeDefined();
    expect(d?.assignedTo).toBe(a.id);
  });

  it('returns undefined for invalid mission', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1' });
    expect(kernel.assignTask('x', 't', a.id)).toBeUndefined();
  });

  it('returns undefined for invalid task', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1' });
    const m = kernel.decomposeMission('m1', 'Research');
    expect(kernel.assignTask(m.id, 'x', a.id)).toBeUndefined();
  });

  it('returns undefined for invalid agent', () => {
    const m = kernel.decomposeMission('m1', 'Research');
    expect(kernel.assignTask(m.id, m.decomposedTasks[0].id, 'x')).toBeUndefined();
  });

  it('reports result', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] });
    const m = kernel.decomposeMission('m1', 'Research');
    const d = kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    kernel.reportResult(d!.id, { agentId: a.id, success: true, outcome: 'Done', duration: 100 });
    expect(kernel.getDelegationManager().get(d!.id)?.status).toBe('completed');
  });

  it('consolidates mission', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] });
    const m = kernel.decomposeMission('m1', 'Research');
    const d = kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    kernel.reportResult(d!.id, { agentId: a.id, success: true, outcome: 'Done', duration: 100 });
    expect(kernel.consolidateMission(m.id)?.length).toBe(1);
  });

  it('returns undefined for incomplete mission', () => {
    const a = kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] });
    const m = kernel.decomposeMission('m1', 'Research');
    kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    expect(kernel.consolidateMission(m.id)).toBeUndefined();
  });

  it('returns state', () => {
    kernel.registerAgent({ role: 'researcher', name: 'R1' });
    const state = kernel.getState();
    expect(state.activeAgents.length).toBe(1);
  });
});
