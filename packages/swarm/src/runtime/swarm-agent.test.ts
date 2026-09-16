import { describe, it, expect } from 'vitest';
import { SwarmAgent } from './swarm-agent.js';
import { EventChannel } from '../event-channel.js';
import type { BrainAdapter, SwarmTask, AgentState } from './swarm-agent.js';

function createMockBrain(returnValue: string = 'mock output'): BrainAdapter {
  return { process: async () => returnValue };
}

function createFailingBrain(errorMsg: string = 'brain error'): BrainAdapter {
  return { process: async () => { throw new Error(errorMsg); } };
}

function createTask(overrides?: Partial<SwarmTask>): SwarmTask {
  return {
    id: `task-${Date.now()}`,
    goal: 'test goal',
    description: 'test description',
    ...overrides,
  };
}

describe('SwarmAgent', () => {
  it('creates agent with correct properties', () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Test Coder', createMockBrain(), channel);

    expect(agent.id).toBe('agent-1');
    expect(agent.role).toBe('coder');
    expect(agent.name).toBe('Test Coder');
    expect(agent.state).toBe('idle');
    expect(agent.taskCount).toBe(0);
  });

  it('executes task successfully', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain('done'), channel);
    const task = createTask();

    const result = await agent.executeTask(task);

    expect(result.success).toBe(true);
    expect(result.output).toBe('done');
    expect(result.agentId).toBe('agent-1');
    expect(result.taskId).toBe(task.id);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('transitions through states: idle → thinking → executing → completed', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());

    expect(agent.state).toBe('completed');
    expect(agent.stateHistory).toEqual(['thinking', 'executing', 'completed']);
  });

  it('handles brain failure gracefully', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createFailingBrain('boom'), channel);

    const result = await agent.executeTask(createTask());

    expect(result.success).toBe(false);
    expect(result.output).toBe('boom');
    expect(agent.state).toBe('failed');
  });

  it('publishes TASK_STARTED to channel', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask({ id: 'task-42' }));

    const messages = channel.getMessagesFrom('agent-1');
    const started = messages.find(m => m.payload && typeof m.payload === 'object' && 'event' in (m.payload as Record<string, unknown>) && (m.payload as Record<string, unknown>).event === 'TASK_STARTED');
    expect(started).toBeDefined();
  });

  it('publishes TASK_COMPLETED to channel', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());

    const messages = channel.getMessagesFrom('agent-1');
    const completed = messages.find(m => m.payload && typeof m.payload === 'object' && 'event' in (m.payload as Record<string, unknown>) && (m.payload as Record<string, unknown>).event === 'TASK_COMPLETED');
    expect(completed).toBeDefined();
  });

  it('publishes TASK_FAILED alert on brain error', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createFailingBrain('err'), channel);

    await agent.executeTask(createTask());

    const messages = channel.getMessagesFrom('agent-1');
    const failed = messages.find(m => m.type === 'alert');
    expect(failed).toBeDefined();
    expect(failed!.requiresGovernance).toBe(true);
  });

  it('increments task count across multiple tasks', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());
    await agent.executeTask(createTask());
    await agent.executeTask(createTask());

    expect(agent.taskCount).toBe(3);
  });

  it('tracks total and average duration', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());
    await agent.executeTask(createTask());

    const stats = agent.getStats();
    expect(stats.taskCount).toBe(2);
    expect(stats.totalDuration).toBeGreaterThanOrEqual(0);
    expect(stats.avgDuration).toBeGreaterThanOrEqual(0);
  });

  it('reset clears state and history', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());
    expect(agent.state).toBe('completed');

    agent.reset();
    expect(agent.state).toBe('idle');
    expect(agent.stateHistory).toEqual([]);
  });

  it('subscribes to channel on construction', () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    // Agent should be subscribed (no error on send)
    channel.send({
      id: 'msg-1',
      from: 'test',
      to: 'agent-1',
      type: 'coordination',
      payload: { ping: true },
      requiresGovernance: false,
      timestamp: new Date().toISOString(),
    });

    const received = channel.getMessagesFor('agent-1');
    expect(received.length).toBe(1);
  });

  it('reports failure details in channel alert', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createFailingBrain('specific error'), channel);

    await agent.executeTask(createTask());

    const messages = channel.getMessagesFrom('agent-1');
    const alert = messages.find(m => m.type === 'alert');
    expect(alert).toBeDefined();
    const payload = alert!.payload as Record<string, unknown>;
    expect(payload.error).toBe('specific error');
  });

  it('returns state history snapshot', async () => {
    const channel = new EventChannel();
    const agent = new SwarmAgent('agent-1', 'coder', 'Coder', createMockBrain(), channel);

    await agent.executeTask(createTask());

    const history = agent.stateHistory;
    expect(history).toEqual(['thinking', 'executing', 'completed']);
    // Verify it's a copy
    history.push('fake' as AgentState);
    expect(agent.stateHistory).toEqual(['thinking', 'executing', 'completed']);
  });
});
