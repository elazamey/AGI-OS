export interface Checkpoint {
  id: string;
  missionId: string;
  stepId: string;
  state: Record<string, unknown>;
  timestamp: string;
}

export interface RollbackResult {
  checkpointId: string;
  restored: boolean;
  restoredState: Record<string, unknown>;
  timestamp: string;
}

export interface RecoveryAction {
  id: string;
  type: 'retry' | 'rollback' | 'skip' | 'fallback' | 'abort';
  stepId: string;
  reason: string;
  timestamp: string;
}
