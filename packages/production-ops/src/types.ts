export interface ChaosResult {
  scenario: string;
  injected: string;
  recovered: boolean;
  dataLoss: boolean;
  duplicateActions: number;
}

export interface CanaryResult {
  missionId: string;
  success: boolean;
  latency: number;
  safetyIncidents: number;
  timestamp: string;
}

export interface DriftResult {
  metric: string;
  baseline: number;
  current: number;
  drifted: boolean;
  severity: string;
}

export interface SupplyChainResult {
  dependency: string;
  version: string;
  vulnerability: string | null;
  licenseIssue: boolean;
  safe: boolean;
}

export interface DisasterRecoveryResult {
  stateLost: boolean;
  rto: number;
  rpo: number;
  recovered: boolean;
  dataIntegrity: boolean;
}

export interface ColdRestartResult {
  startedFromScratch: boolean;
  stateRecovered: boolean;
  missionsResumed: boolean;
  artifactsIntact: boolean;
}

export interface MigrationResult {
  schemaVersion: string;
  migrated: boolean;
  rollbackPossible: boolean;
  dataIntact: boolean;
}
