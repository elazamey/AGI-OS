import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmKernel } from '../src/swarm-kernel';
import { SwarmFederation } from '@agi-os/swarm-federation';

describe('SwarmKernel ↔ Federation Integration', () => {
  let federation: SwarmFederation;

  beforeEach(() => {
    federation = new SwarmFederation('local-node');
  });

  it('should initialize SwarmKernel with custom federation instance', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    expect(kernel.getFederation()).toBe(federation);
  });

  it('should create default federation when none provided', () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    expect(kernel.getFederation()).toBeDefined();
  });

  it('should register agents with the federation network', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    const agent = kernel.registerAgent({
      role: 'coder',
      name: 'federated-coder-1',
      capabilities: ['typescript', 'node'],
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('federated-coder-1');
  });

  it('should track registered nodes in federation', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    kernel.registerAgent({
      role: 'coder',
      name: 'node-1',
      capabilities: ['coding'],
    });
    kernel.registerAgent({
      role: 'researcher',
      name: 'node-2',
      capabilities: ['research'],
    });

    const nodes = federation.getOnlineNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('should sync task assignment with federation', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    const coder = kernel.registerAgent({
      role: 'coder',
      name: 'coder-1',
      capabilities: ['coding'],
    });

    const mission = kernel.decomposeMission('m1', 'build feature');
    const task = mission.decomposedTasks[0];

    const delegation = kernel.assignTask('m1', task.id, coder.id);
    expect(delegation).toBeDefined();
  });

  it('should report results through federation', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    const coder = kernel.registerAgent({
      role: 'coder',
      name: 'coder-1',
      capabilities: ['coding'],
    });

    const mission = kernel.decomposeMission('m1', 'build feature');
    const task = mission.decomposedTasks[0];
    const delegation = kernel.assignTask('m1', task.id, coder.id);

    if (delegation) {
      kernel.reportResult(delegation.id, {
        agentId: coder.id,
        success: true,
        outcome: 'Task completed',
        duration: 100,
      });
    }

    const assignments = federation.getAllTasks();
    expect(assignments.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle cross-node task distribution', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });

    const coder1 = kernel.registerAgent({ role: 'coder', name: 'coder-1', capabilities: ['coding'] });
    const coder2 = kernel.registerAgent({ role: 'coder', name: 'coder-2', capabilities: ['coding'] });

    const mission = kernel.decomposeMission('m1', 'build and test feature');

    const task1 = mission.decomposedTasks[0];
    const task2 = mission.decomposedTasks[1] || task1;

    const d1 = kernel.assignTask('m1', task1.id, coder1.id);
    const d2 = kernel.assignTask('m1', task2.id, coder2.id);

    expect(d1).toBeDefined();
    expect(d2).toBeDefined();
  });

  it('should allow custom federation stub for testing', () => {
    const customFederation = new SwarmFederation('test-node');
    const kernel = new SwarmKernel({
      federation: customFederation,
      config: { enableGovernanceIntercept: false },
    });
    const agent = kernel.registerAgent({ role: 'coder', name: 'test-agent', capabilities: ['test'] });

    const node = customFederation.getNode(agent.id);
    expect(node).toBeDefined();
  });

  it('should expose federation state through kernel', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });

    kernel.registerAgent({ role: 'coder', name: 'a1', capabilities: ['c'] });
    kernel.registerAgent({ role: 'auditor', name: 'a2', capabilities: ['a'] });

    const nodes = federation.getOnlineNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(kernel.getFederation()).toBe(federation);
  });

  it('should not fail when federation has no nodes', () => {
    const kernel = new SwarmKernel({ federation, config: { enableGovernanceIntercept: false } });
    expect(() => federation.getOnlineNodes()).not.toThrow();
  });
});
