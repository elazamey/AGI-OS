import { generateId } from '@agi-os/kernel';

export interface GoldenMissionConfig {
  id: string;
  name: string;
  description: string;
  steps: MissionStep[];
}

export interface MissionStep {
  id: string;
  name: string;
  action: string;
  params: Record<string, unknown>;
  expectedOutcome: string;
}

export interface MissionResult {
  missionId: string;
  success: boolean;
  steps: StepResult[];
  evidence: Evidence[];
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface Evidence {
  type: string;
  hash: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export abstract class GoldenMission {
  protected config: GoldenMissionConfig;

  constructor(config: GoldenMissionConfig) {
    this.config = config;
  }

  abstract execute(): Promise<MissionResult>;

  getConfig(): GoldenMissionConfig {
    return this.config;
  }

  protected createEvidence(type: string, data: unknown): Evidence {
    return {
      type,
      hash: generateId(),
      timestamp: Date.now(),
      metadata: { data },
    };
  }
}
