import type { RiskLevel, PolicyDecision } from '@agi-os/governance';

export type SandboxType = 'wasm' | 'docker';
export type CodeLanguage = 'javascript' | 'typescript' | 'python';

export interface SandboxConfig {
  id: string;
  type: SandboxType;
  language: CodeLanguage;
  timeout: number;
  memoryLimit: number;
  networkAccess: boolean;
  filesystemAccess: 'none' | 'readonly' | 'sandboxed';
  allowedModules: string[];
}

export interface SandboxExecution {
  id: string;
  sandboxId: string;
  code: string;
  language: CodeLanguage;
  stdin?: string;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration?: number;
  timedOut: boolean;
  governanceDecision: PolicyDecision;
}

export interface SandboxResult {
  execution: SandboxExecution;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface CodeViolation {
  line: number;
  column: number;
  rule: string;
  description: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface CodeValidation {
  valid: boolean;
  violations: CodeViolation[];
  riskLevel: RiskLevel;
}
