import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/StateManager.js';
import { MissionState } from '../src/MissionRuntime.js';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  it('should create empty state manager', () => {
    expect(stateManager).toBeDefined();
  });

  it('should save and load mission state', async () => {
    const state: MissionState = {
      id: 'mission-1',
      status: 'running',
      tasks: [],
      results: new Map(),
      agents: [],
    };

    await stateManager.saveMissionState('mission-1', state);
    const loaded = await stateManager.loadMissionState('mission-1');

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe('mission-1');
    expect(loaded?.status).toBe('running');
  });

  it('should return null for non-existent mission', async () => {
    const loaded = await stateManager.loadMissionState('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete mission state', async () => {
    const state: MissionState = {
      id: 'mission-1',
      status: 'running',
      tasks: [],
      results: new Map(),
      agents: [],
    };

    await stateManager.saveMissionState('mission-1', state);
    await stateManager.deleteMissionState('mission-1');
    const loaded = await stateManager.loadMissionState('mission-1');

    expect(loaded).toBeNull();
  });

  it('should save and load checkpoint', async () => {
    const checkpoint = {
      missionId: 'mission-1',
      revision: 1,
      state: { status: 'running', progress: 50 },
      timestamp: new Date().toISOString(),
    };

    await stateManager.saveCheckpoint('mission-1', checkpoint);
    const loaded = await stateManager.loadCheckpoint('mission-1');

    expect(loaded).toBeDefined();
    expect(loaded?.missionId).toBe('mission-1');
    expect(loaded?.revision).toBe(1);
  });

  it('should return null for non-existent checkpoint', async () => {
    const loaded = await stateManager.loadCheckpoint('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete checkpoint', async () => {
    const checkpoint = {
      missionId: 'mission-1',
      revision: 1,
      state: { status: 'running' },
      timestamp: new Date().toISOString(),
    };

    await stateManager.saveCheckpoint('mission-1', checkpoint);
    await stateManager.deleteCheckpoint('mission-1');
    const loaded = await stateManager.loadCheckpoint('mission-1');

    expect(loaded).toBeNull();
  });

  it('should list missions', async () => {
    const state1: MissionState = { id: 'mission-1', status: 'running', tasks: [], results: new Map(), agents: [] };
    const state2: MissionState = { id: 'mission-2', status: 'completed', tasks: [], results: new Map(), agents: [] };

    await stateManager.saveMissionState('mission-1', state1);
    await stateManager.saveMissionState('mission-2', state2);

    const missions = await stateManager.listMissions();
    expect(missions).toHaveLength(2);
    expect(missions).toContain('mission-1');
    expect(missions).toContain('mission-2');
  });

  it('should list checkpoints', async () => {
    await stateManager.saveCheckpoint('mission-1', {
      missionId: 'mission-1',
      revision: 1,
      state: {},
      timestamp: new Date().toISOString(),
    });
    await stateManager.saveCheckpoint('mission-2', {
      missionId: 'mission-2',
      revision: 1,
      state: {},
      timestamp: new Date().toISOString(),
    });

    const checkpoints = await stateManager.listCheckpoints();
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints).toContain('mission-1');
    expect(checkpoints).toContain('mission-2');
  });
});
