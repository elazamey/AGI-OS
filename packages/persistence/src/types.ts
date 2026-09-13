export interface Checkpoint {
  missionId: string;
  revision: number;
  state: Record<string, unknown>;
  taskResults: Record<string, unknown>;
  evidence: unknown[];
  timestamp: string;
}
