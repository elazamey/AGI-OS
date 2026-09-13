import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmKernel } from '../src/swarm-kernel.js';
import { DefaultTaskDecomposer } from '../src/swarm-kernel.js';
import { GovernanceGateway } from '@agi-os/governance';

describe('Dark Swarm — Integration', () => {
  let kernel: SwarmKernel;
  beforeEach(() => { kernel = new SwarmKernel({ governance: new GovernanceGateway() }); });

  it('full cycle: register → decompose → assign → execute → consolidate', () => {
    const r = kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] });
    const c = kernel.registerAgent({ role: 'coder', name: 'C1', capabilities: ['coding'] });
    const m = kernel.decomposeMission('m1', 'Research and implement a feature');
    expect(m.decomposedTasks.length).toBeGreaterThanOrEqual(2);

    for (const task of m.decomposedTasks) {
      const agent = task.requiredRole === 'researcher' ? r : c;
      const d = kernel.assignTask(m.id, task.id, agent.id);
      expect(d).toBeDefined();
      kernel.reportResult(d!.id, { agentId: agent.id, success: true, outcome: `${task.goal} done`, duration: 100 });
    }
    expect(kernel.consolidateMission(m.id)?.length).toBe(m.decomposedTasks.length);
  });

  it('multi-agent parallel execution', () => {
    const agents = [
      kernel.registerAgent({ role: 'researcher', name: 'R1', capabilities: ['research'] }),
      kernel.registerAgent({ role: 'coder', name: 'C1', capabilities: ['coding'] }),
      kernel.registerAgent({ role: 'auditor', name: 'A1', capabilities: ['audit'] }),
    ];
    const m = kernel.decomposeMission('m1', 'Research, implement, and review a feature');
    const delegations = [];
    for (const task of m.decomposedTasks) {
      const a = agents.find(a => a.role === task.requiredRole);
      if (a) { const d = kernel.assignTask(m.id, task.id, a.id); if (d) delegations.push(d); }
    }
    expect(delegations.length).toBe(3);
    for (const d of delegations) kernel.reportResult(d.id, { agentId: d.assignedTo, success: true, outcome: 'Done', duration: 100 });
    expect(kernel.consolidateMission(m.id)?.length).toBe(3);
  });

  it('cost guard enforces $0', () => {
    const a = kernel.registerAgent({ role: 'coder', name: 'C1' });
    const d = kernel.getDelegationManager().create({ parentMissionId: 'm1', goal: 'G', assignedTo: a.id, assignedBy: 'k' });
    expect(d.constraints.maxCost).toBe(0);
  });

  it('supervisor tracks health across tasks', () => {
    const a = kernel.registerAgent({ role: 'coder', name: 'C1' });
    const m = kernel.decomposeMission('m1', 'Build something');
    const d = kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    expect(kernel.getSupervisor().getHealth(a.id)?.activeTaskCount).toBe(1);
    kernel.reportResult(d!.id, { agentId: a.id, success: true, outcome: 'Done', duration: 50 });
    expect(kernel.getSupervisor().getHealth(a.id)?.completedTasks).toBe(1);
  });

  it('task decomposer finds research', () => {
    const d = new DefaultTaskDecomposer();
    expect(d.decompose('Analyze the metrics').some(t => t.requiredRole === 'researcher')).toBe(true);
  });

  it('task decomposer finds coding', () => {
    const d = new DefaultTaskDecomposer();
    expect(d.decompose('Implement the feature').some(t => t.requiredRole === 'coder')).toBe(true);
  });

  it('task decomposer finds audit', () => {
    const d = new DefaultTaskDecomposer();
    expect(d.decompose('Verify the audit').some(t => t.requiredRole === 'auditor')).toBe(true);
  });

  it('failed task reported correctly', () => {
    const a = kernel.registerAgent({ role: 'coder', name: 'C1', capabilities: ['coding'] });
    const m = kernel.decomposeMission('m1', 'Build');
    const d = kernel.assignTask(m.id, m.decomposedTasks[0].id, a.id);
    kernel.reportResult(d!.id, { agentId: a.id, success: false, outcome: 'Failed', duration: 50 });
    expect(kernel.getDelegationManager().get(d!.id)?.status).toBe('completed');
  });
});
