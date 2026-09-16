export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'WARN';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SBOMEntry {
  name: string;
  version: string;
  license: string;
  integrity?: string;
  depth: number;
}

export interface DependencyAuditResult {
  package: string;
  currentVersion: string;
  severity: Severity;
  advisory?: string;
  fixAvailable: boolean;
  fixVersion?: string;
}

export interface RegressionThreshold {
  metric: string;
  baseline: number;
  threshold: number;
  unit: string;
}

export interface ProductionGateReport {
  timestamp: string;
  version: string;
  gates: GateResult[];
  overallStatus: GateStatus;
  durationMs: number;
  sbom: SBOMEntry[];
  dependencies: DependencyAuditResult[];
  regressions: RegressionCheck[];
}

export interface GateResult {
  gate: string;
  status: GateStatus;
  details: string[];
  durationMs: number;
}

export interface RegressionCheck {
  metric: string;
  baseline: number;
  current: number;
  passed: boolean;
  deviation: number;
}
