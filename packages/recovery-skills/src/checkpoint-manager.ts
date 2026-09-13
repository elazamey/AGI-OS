import { generateId, now } from '@agi-os/kernel';
import type { Checkpoint } from './types.js';

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];

  create(missionId: string, stepId: string, state: Record<string, unknown>): Checkpoint {
    const checkpoint: Checkpoint = {
      id: generateId(),
      missionId,
      stepId,
      state: { ...state },
      timestamp: now().toISOString(),
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  getLatest(missionId: string): Checkpoint | undefined {
    const mission = this.checkpoints.filter(c => c.missionId === missionId);
    return mission[mission.length - 1];
  }

  getCheckpoints(missionId: string): Checkpoint[] {
    return this.checkpoints.filter(c => c.missionId === missionId);
  }

  getByStep(missionId: string, stepId: string): Checkpoint | undefined {
    return this.checkpoints.find(c => c.missionId === missionId && c.stepId === stepId);
  }

  clear(missionId?: string): void {
    if (missionId) this.checkpoints = this.checkpoints.filter(c => c.missionId !== missionId);
    else this.checkpoints = [];
  }

  count(missionId?: string): number {
    return missionId ? this.checkpoints.filter(c => c.missionId === missionId).length : this.checkpoints.length;
  }
}
