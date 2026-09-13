export interface ReplayResult {
  id: string;
  originalTimestamp: string;
  replayedTimestamp: string;
  input: unknown;
  originalOutput: unknown;
  replayedOutput: unknown;
  match: boolean;
  deterministic: boolean;
}

export interface CrashScenario {
  id: string;
  name: string;
  description: string;
  type: 'power-loss' | 'oom' | 'timeout' | 'network-drop' | 'corruption';
  trigger: () => void;
  recovery: () => Promise<boolean>;
}

export interface CrashRecoveryResult {
  scenario: CrashScenario;
  recovered: boolean;
  dataIntegrity: boolean;
  durationMs: number;
  details: string;
}

export interface RaceCondition {
  id: string;
  name: string;
  description: string;
  operations: Array<() => Promise<unknown>>;
  expectedBehavior: 'serial' | 'last-write-wins' | 'merge' | 'reject';
}

export interface RaceTestResult {
  race: RaceCondition;
  actualBehavior: string;
  passed: boolean;
  conflicts: number;
  durationMs: number;
}

export interface ResilienceReport {
  replay: ReplayResult[];
  crashRecovery: CrashRecoveryResult[];
  raceConditions: RaceTestResult[];
  overallScore: number;
  timestamp: string;
}
