export type EscapeAttemptResult = 'blocked' | 'escaped' | 'contained';
export type AttackCategory = 'filesystem' | 'network' | 'process' | 'memory' | 'capability' | 'injection' | 'privilege';

export interface EscapeAttempt {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  payload: string;
  expected: EscapeAttemptResult;
}

export interface EscapeTestResult {
  attempt: EscapeAttempt;
  actual: EscapeAttemptResult;
  passed: boolean;
  details: string;
  durationMs: number;
}

export interface AdversarialSuiteResult {
  total: number;
  passed: number;
  failed: number;
  escaped: number;
  contained: number;
  results: EscapeTestResult[];
  durationMs: number;
  timestamp: string;
}

export interface CapabilityBoundary {
  capability: string;
  allowed: boolean;
  reason: string;
}

export interface SandboxConfig {
  maxMemoryBytes: number;
  maxCpuTimeMs: number;
  allowedModules: string[];
  deniedModules: string[];
  networkAccess: boolean;
  filesystemRoot: string;
}
