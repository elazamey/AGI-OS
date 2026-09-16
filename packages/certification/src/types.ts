export type TestStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
export type GateId = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10' | 'G11' | 'G12' | 'G13' | 'G14' | 'G15' | 'G16' | 'G17' | 'G18' | 'G19' | 'G20';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ReleaseDecision = 'CERTIFIED' | 'CONDITIONAL' | 'BLOCKED';

export interface TestCase {
  id: string;
  gate: GateId;
  name: string;
  description: string;
  severity: Severity;
  timeout: number;
}

export interface TestEvidence {
  testId: string;
  timestamp: string;
  gitSha: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  status: TestStatus;
  durationMs: number;
  logs: string[];
  artifacts: string[];
  evidenceHash: string;
}

export interface GateResult {
  gate: GateId;
  name: string;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  passRate: number;
  status: TestStatus;
  durationMs: number;
  evidence: TestEvidence[];
}

export interface CertificationReport {
  version: string;
  gitSha: string;
  timestamp: string;
  environment: { node: string; platform: string; arch: string };
  gates: GateResult[];
  overallScore: number;
  overallStatus: TestStatus;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalBlocked: number;
  criticalFindings: string[];
  knownLimitations: string[];
  releaseDecision: ReleaseDecision;
  durationMs: number;
}

export interface GoldenMission {
  id: string;
  name: string;
  description: string;
  steps: string[];
  expectedOutcome: string;
  requiredCapabilities: string[];
  timeout: number;
}

export interface GoldenMissionResult {
  mission: GoldenMission;
  status: TestStatus;
  stepsCompleted: number;
  totalSteps: number;
  evidence: TestEvidence[];
  durationMs: number;
  score: number;
}
