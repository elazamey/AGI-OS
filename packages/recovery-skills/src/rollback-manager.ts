import { now } from '@agi-os/kernel';
import type { RollbackResult } from './types.js';
import { CheckpointManager } from './checkpoint-manager.js';

export class RollbackManager {
  private checkpoints: CheckpointManager;

  constructor(checkpointManager?: CheckpointManager) {
    this.checkpoints = checkpointManager ?? new CheckpointManager();
  }

  rollback(checkpointId: string): RollbackResult {
    const checkpoint = this.checkpoints.getCheckpointById(checkpointId);
    if (!checkpoint) {
      return { checkpointId, restored: false, restoredState: {}, timestamp: now().toISOString() };
    }
    return {
      checkpointId,
      restored: true,
      restoredState: { ...checkpoint.state },
      timestamp: now().toISOString(),
    };
  }

  rollbackToLatest(missionId: string): RollbackResult {
    const latest = this.checkpoints.getLatest(missionId);
    if (!latest) return { checkpointId: '', restored: false, restoredState: {}, timestamp: now().toISOString() };
    return this.rollback(latest.id);
  }

  getCheckpointManager(): CheckpointManager { return this.checkpoints; }
}
