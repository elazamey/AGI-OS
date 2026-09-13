import { describe, it, expect, beforeEach } from 'vitest';
import { MissionRuntime, TaskDefinition, AgentInstance } from '../src/MissionRuntime.js';

describe('MissionRuntime', () => {
  let runtime: MissionRuntime;

  beforeEach(() => {
    runtime = new MissionRuntime({
      maxConcurrentAgents: 3,
      taskTimeoutMs: 5000,
      maxRetries: 2,
    });
  });

  it('should create runtime with default config', () => {
    const defaultRuntime = new MissionRuntime();
    expect(defaultRuntime).toBeDefined();
  });

  it('should create runtime with custom config', () => {
    expect(runtime).toBeDefined();
  });

  it('should create mission', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    expect(missionId).toBeDefined();

    const state = await runtime.getMissionState(missionId);
    expect(state).toBeDefined();
    expect(state?.status).toBe('pending');
  });

  it('should get mission state', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    const state = await runtime.getMissionState(missionId);

    expect(state).toBeDefined();
    expect(state?.id).toBe(missionId);
  });

  it('should return null for non-existent mission', async () => {
    const state = await runtime.getMissionState('non-existent');
    expect(state).toBeNull();
  });

  it('should complete mission', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    const completedState = await runtime.completeMission(missionId);

    expect(completedState.status).toBe('completed');
    expect(completedState.endTime).toBeDefined();
  });

  it('should fail mission', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    await runtime.failMission(missionId, 'Test error');

    const state = await runtime.getMissionState(missionId);
    expect(state?.status).toBe('failed');
    expect(state?.error).toBe('Test error');
  });

  it('should throw error for non-existent mission on complete', async () => {
    await expect(runtime.completeMission('non-existent')).rejects.toThrow('Mission non-existent not found');
  });

  it('should throw error for non-existent mission on fail', async () => {
    await expect(runtime.failMission('non-existent', 'error')).rejects.toThrow('Mission non-existent not found');
  });

  it('should add agent', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    
    // Start mission to add agents
    // Note: This would normally start execution, but we're testing agent management
    const agent: AgentInstance = {
      id: 'agent-1',
      type: 'test',
      status: 'idle',
      capabilities: ['test'],
    };

    // For testing, we need to manually set the mission to running state
    const state = await runtime.getMissionState(missionId);
    if (state) {
      state.status = 'running';
      state.agents.push(agent);
    }

    const agentStatus = await runtime.getAgentStatus('agent-1');
    expect(agentStatus).toBeDefined();
    expect(agentStatus?.id).toBe('agent-1');
  });

  it('should remove agent', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    const state = await runtime.getMissionState(missionId);
    
    if (state) {
      state.status = 'running';
      state.agents.push({
        id: 'agent-1',
        type: 'test',
        status: 'idle',
        capabilities: ['test'],
      });
    }

    await runtime.removeAgent('agent-1');
    const agentStatus = await runtime.getAgentStatus('agent-1');
    expect(agentStatus).toBeNull();
  });

  it('should get mission results', async () => {
    const tasks: TaskDefinition[] = [
      { id: 'task-1', type: 'test', payload: {}, priority: 1 },
    ];

    const missionId = await runtime.createMission(tasks);
    const results = await runtime.getMissionResults(missionId);

    expect(results).toBeDefined();
    expect(results.size).toBe(0);
  });

  it('should throw error for non-existent mission on getResults', async () => {
    await expect(runtime.getMissionResults('non-existent')).rejects.toThrow('Mission non-existent not found');
  });
});
