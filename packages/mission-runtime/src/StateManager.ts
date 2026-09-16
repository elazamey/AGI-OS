import type { MissionState } from './MissionRuntime.js';

export interface Checkpoint {
  missionId: string;
  revision: number;
  state: Record<string, unknown>;
  timestamp: string;
}

export class StateManager {
  private missionStates: Map<string, MissionState> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();

  async saveMissionState(missionId: string, state: MissionState): Promise<void> {
    this.missionStates.set(missionId, { ...state });
  }

  async loadMissionState(missionId: string): Promise<MissionState | null> {
    return this.missionStates.get(missionId) || null;
  }

  async deleteMissionState(missionId: string): Promise<void> {
    this.missionStates.delete(missionId);
  }

  async saveCheckpoint(missionId: string, checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(missionId, checkpoint);
  }

  async loadCheckpoint(missionId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(missionId) || null;
  }

  async deleteCheckpoint(missionId: string): Promise<void> {
    this.checkpoints.delete(missionId);
  }

  async listMissions(): Promise<string[]> {
    return Array.from(this.missionStates.keys());
  }

  async listCheckpoints(): Promise<string[]> {
    return Array.from(this.checkpoints.keys());
  }
}
