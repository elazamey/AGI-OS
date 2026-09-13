import { generateId } from '@agi-os/kernel';
import { TaskQueue } from './TaskQueue.js';
import { StateManager } from './StateManager.js';
import { ConcurrentAgentExecutor } from './ConcurrentAgentExecutor.js';

export interface MissionConfig {
  maxConcurrentAgents?: number;
  taskTimeoutMs?: number;
  maxRetries?: number;
  enableCheckpointing?: boolean;
}

export interface MissionState {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  tasks: TaskDefinition[];
  results: Map<string, TaskResult>;
  agents: AgentInstance[];
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface TaskDefinition {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  dependencies?: string[];
  assignedAgent?: string;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'failed' | 'timeout';
  data?: unknown;
  error?: string;
  durationMs: number;
  evidence?: Evidence[];
}

export interface Evidence {
  type: string;
  hash: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface AgentInstance {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'failed';
  currentTask?: string;
  capabilities: string[];
}

export class MissionRuntime {
  private config: MissionConfig;
  private stateManager: StateManager;
  private taskQueue: TaskQueue;
  private executor: ConcurrentAgentExecutor;
  private missions: Map<string, MissionState> = new Map();

  constructor(config: MissionConfig = {}) {
    this.config = {
      maxConcurrentAgents: 5,
      taskTimeoutMs: 60000,
      maxRetries: 3,
      enableCheckpointing: true,
      ...config,
    };
    this.stateManager = new StateManager();
    this.taskQueue = new TaskQueue();
    this.executor = new ConcurrentAgentExecutor(this.config);
  }

  async createMission(tasks: TaskDefinition[]): Promise<string> {
    const missionId = generateId();
    const state: MissionState = {
      id: missionId,
      status: 'pending',
      tasks,
      results: new Map(),
      agents: [],
    };
    this.missions.set(missionId, state);
    await this.stateManager.saveMissionState(missionId, state);
    return missionId;
  }

  async startMission(missionId: string): Promise<void> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    state.status = 'running';
    state.startTime = Date.now();
    await this.stateManager.saveMissionState(missionId, state);

    for (const task of state.tasks) {
      this.taskQueue.enqueue(task);
    }

    await this.executor.executeQueue(this.taskQueue, state);
  }

  async pauseMission(missionId: string): Promise<void> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    state.status = 'paused';
    await this.stateManager.saveMissionState(missionId, state);
  }

  async resumeMission(missionId: string): Promise<void> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    state.status = 'running';
    await this.stateManager.saveMissionState(missionId, state);
    await this.executor.executeQueue(this.taskQueue, state);
  }

  async completeMission(missionId: string): Promise<MissionState> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    state.status = 'completed';
    state.endTime = Date.now();
    await this.stateManager.saveMissionState(missionId, state);
    return state;
  }

  async failMission(missionId: string, error: string): Promise<void> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    state.status = 'failed';
    state.error = error;
    state.endTime = Date.now();
    await this.stateManager.saveMissionState(missionId, state);
  }

  async getMissionState(missionId: string): Promise<MissionState | null> {
    return this.missions.get(missionId) || null;
  }

  async getMissionResults(missionId: string): Promise<Map<string, TaskResult>> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);
    return state.results;
  }

  async addAgent(agent: AgentInstance): Promise<void> {
    const state = Array.from(this.missions.values()).find(m => m.status === 'running');
    if (state) {
      state.agents.push(agent);
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    const state = Array.from(this.missions.values()).find(m => m.status === 'running');
    if (state) {
      state.agents = state.agents.filter(a => a.id !== agentId);
    }
  }

  async getAgentStatus(agentId: string): Promise<AgentInstance | null> {
    const state = Array.from(this.missions.values()).find(m => m.status === 'running');
    if (!state) return null;
    return state.agents.find(a => a.id === agentId) || null;
  }

  async checkpoint(missionId: string): Promise<void> {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Mission ${missionId} not found`);

    await this.stateManager.saveCheckpoint(missionId, {
      missionId,
      revision: Date.now(),
      state: {
        status: state.status,
        tasks: state.tasks,
        results: Object.fromEntries(state.results),
      },
      timestamp: new Date().toISOString(),
    });
  }

  async restore(missionId: string): Promise<void> {
    const checkpoint = await this.stateManager.loadCheckpoint(missionId);
    if (!checkpoint) throw new Error(`No checkpoint found for mission ${missionId}`);

    const state = this.missions.get(missionId);
    if (state) {
      const stateData = checkpoint.state as {
        status: MissionState['status'];
        tasks: TaskDefinition[];
        results: Record<string, TaskResult>;
      };
      state.status = stateData.status;
      state.tasks = stateData.tasks;
      state.results = new Map(Object.entries(stateData.results));
    }
  }
}
