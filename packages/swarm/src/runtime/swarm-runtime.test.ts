import { describe, it, expect } from 'vitest';
import { SwarmRuntime } from './swarm-runtime.js';
import { SwarmAgent } from './swarm-agent.js';
import { SwarmKernel } from '../swarm-kernel.js';
import { EventChannel } from '../event-channel.js';
import type { BrainAdapter } from './swarm-agent.js';
import type { AgentRole } from '../types.js';

function createBrain(output: string = 'done'): BrainAdapter {
  return { process: async () => output };
}

function createAgent(id: string, role: AgentRole): SwarmAgent {
  return new SwarmAgent(id, role, `Agent ${id}`, createBrain(`output-${id}`), new EventChannel());
}

describe('SwarmRuntime', () => {
  it('registers and retrieves agents', () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    const agent = createAgent('a1', 'coder');

    runtime.registerAgent(agent);

    expect(runtime.getAgent('a1')).toBe(agent);
    expect(runtime.getRegisteredAgents()).toHaveLength(1);
  });

  it('unregisters agents', () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    const agent = createAgent('a1', 'coder');

    runtime.registerAgent(agent);
    expect(runtime.unregisterAgent('a1')).toBe(true);
    expect(runtime.getAgent('a1')).toBeUndefined();
  });

  it('executes a single-task mission with one agent', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    runtime.registerAgent(createAgent('a1', 'coder'));

    const records = await runtime.executeMission('build a feature');

    expect(records.length).toBe(1);
    expect(records[0].success).toBe(true);
    expect(records[0].agentId).toBe('a1');
  });

  it('executes multi-task mission with role-matched agents', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    runtime.registerAgent(createAgent('r1', 'researcher'));
    runtime.registerAgent(createAgent('c1', 'coder'));
    runtime.registerAgent(createAgent('a1', 'auditor'));

    const records = await runtime.executeMission('research, implement, and review a feature');

    expect(records.length).toBe(3);
    expect(records.every(r => r.success)).toBe(true);
  });

  it('reports failure when no agent matches role', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    // Only register a coder, mission needs researcher
    runtime.registerAgent(createAgent('c1', 'coder'));

    const records = await runtime.executeMission('research a topic');

    // No researcher available, so task should fail with "No suitable agent"
    expect(records.some(r => !r.success)).toBe(true);
  });

  it('tracks execution history', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    runtime.registerAgent(createAgent('a1', 'coder'));

    await runtime.executeMission('build something');
    await runtime.executeMission('build another');

    const history = runtime.getExecutionHistory();
    expect(history.length).toBe(2);
  });

  it('computes stats correctly', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    runtime.registerAgent(createAgent('a1', 'coder'));

    await runtime.executeMission('build feature');

    const stats = runtime.getStats();
    expect(stats.totalExecutions).toBe(1);
    expect(stats.successfulExecutions).toBe(1);
    expect(stats.failedExecutions).toBe(0);
    expect(stats.activeAgents).toBe(1);
  });

  it('load-balances across agents with same role', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    runtime.registerAgent(createAgent('c1', 'coder'));
    runtime.registerAgent(createAgent('c2', 'coder'));

    await runtime.executeMission('build feature 1');
    await runtime.executeMission('build feature 2');

    const history = runtime.getExecutionHistory();
    const agent1Tasks = history.filter(r => r.agentId === 'c1').length;
    const agent2Tasks = history.filter(r => r.agentId === 'c2').length;

    // Load balancing: each should get roughly equal tasks
    expect(Math.abs(agent1Tasks - agent2Tasks)).toBeLessThanOrEqual(1);
  });

  it('tracks active count during execution', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);
    runtime.registerAgent(createAgent('a1', 'coder'));

    expect(runtime.getActiveCount()).toBe(0);
    await runtime.executeMission('build');
    expect(runtime.getActiveCount()).toBe(0); // completed
  });

  it('returns empty history initially', () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    expect(runtime.getExecutionHistory()).toEqual([]);
    expect(runtime.getStats().totalExecutions).toBe(0);
  });

  it('handles mixed success/failure across agents', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    const goodAgent = new SwarmAgent('good', 'coder', 'Good', createBrain('ok'), new EventChannel());
    const badAgent = new SwarmAgent('bad', 'auditor', 'Bad', (() => {
      const brain: BrainAdapter = { process: async () => { throw new Error('fail'); } };
      return brain;
    })(), new EventChannel());

    runtime.registerAgent(goodAgent);
    runtime.registerAgent(badAgent);

    const records = await runtime.executeMission('implement and review');

    expect(records.some(r => r.success)).toBe(true);
    expect(records.some(r => !r.success)).toBe(true);
  });

  it('custom role agent matches any required role', async () => {
    const kernel = new SwarmKernel({ config: { enableGovernanceIntercept: false } });
    const runtime = new SwarmRuntime(kernel);

    runtime.registerAgent(createAgent('flex', 'custom'));

    const records = await runtime.executeMission('build something');

    expect(records.length).toBe(1);
    expect(records[0].agentId).toBe('flex');
  });
});
