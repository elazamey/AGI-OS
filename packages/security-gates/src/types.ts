export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';

export interface GateResult {
  gate: string;
  status: GateStatus;
  tests: number;
  passed: number;
  failed: number;
  details: string[];
  duration: number;
  timestamp: string;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  executionId: string;
  agentId: string;
  tool: string;
  inputHash: string;
  outputHash: string;
  policyDecision: string;
  timestamp: string;
  result: string;
  parentEventId?: string;
}

export interface ReleaseReport {
  version: string;
  gates: GateResult[];
  overallStatus: GateStatus;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  timestamp: string;
}
