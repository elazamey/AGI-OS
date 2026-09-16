import type { RiskLevel, PolicyDecision } from '@agi-os/governance';
import type { IsolationLevel } from './isolation/types.js';

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
  /**
   * Which isolation boundary runs the guest. 'vm' is a separate V8 realm with
   * eval/new Function disabled; 'subprocess' is a separate OS process under
   * Node's permission model and is the correct choice for untrusted code.
   */
  isolation: IsolationLevel;
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
  /** True when the guest was killed (timeout, OOM, policy). */
  killed?: boolean;
  governanceDecision: PolicyDecision;
  /** Boundary that actually ran the code. */
  isolation: IsolationLevel;
  /**
   * Declared limits this boundary could NOT enforce. Never empty-by-omission:
   * a caller must be able to see that e.g. memoryLimit is not enforced by 'vm'.
   */
  unenforcedLimits: string[];
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
