// ============================================================================
// AGI OS - Adversarial Suite Contracts
// ----------------------------------------------------------------------------
// The verdict model is the whole point of this package.
//
// The previous implementation classified an attempt as "blocked" when
// `SandboxEnforcer.checkCapability(`${category}.execute`)` returned false — and
// that method has no key for any `*.execute` capability, so it ALWAYS returned
// false. Every one of the 18 attempts was therefore reported as blocked by
// construction, `escaped` was structurally incapable of being non-zero, and the
// suite passed 18/18 while executing nothing at all.
//
// Containment is now MEASURED. Each attempt carries executable code and a
// predicate that inspects what actually came back and answers one question:
// did the attacker achieve their goal?
// ============================================================================

/** Which layer is under test. */
export type DefenceLayer =
  /** Source blocklist + governance + isolation (the full SandboxManager). */
  | 'blocklist'
  /** Isolation only — the CodeValidator is deliberately bypassed. */
  | 'isolation';

/** What a single execution actually produced. */
export interface Observation {
  /** True when the guest ran at all (rather than being refused up front). */
  ran: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  killed: boolean;
  /** Declared limits the boundary admitted it could not enforce. */
  unenforced: string[];
  /**
   * Set by the suite for attempts that could affect the HOST realm (e.g.
   * prototype pollution). Checked after the guest finishes.
   */
  hostPolluted?: boolean;
  /** Thrown by the harness itself, not by guest code. */
  harnessError?: string;
}

/** How an attempt ended, decided from the Observation — never assumed. */
export type ContainmentVerdict =
  /** The attacker got what they wanted. This is a failure of the sandbox. */
  | 'escaped'
  /** The guest ran but the goal was not achieved. */
  | 'contained'
  /** The guest never ran: refused, threw, or was killed. */
  | 'blocked';

export type AttackCategory =
  | 'filesystem'
  | 'process'
  | 'network'
  | 'memory'
  | 'injection'
  | 'privilege';

export interface EscapeAttempt {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  /**
   * What the attacker is trying to obtain or do. Printed in every report so a
   * human can judge whether the verification predicate is honest.
   */
  goal: string;
  /** Executable guest code. Must be real code, never prose. */
  payload: string;
  /**
   * Language to submit the payload as. Defaults to 'javascript'. Declaring
   * another language is how the suite proves an unsupported language is refused
   * rather than silently executed or faked.
   */
  language?: 'javascript' | 'typescript' | 'python';
  /**
   * Returns true when the attacker ACHIEVED the goal.
   * This is the only thing that can produce an `escaped` verdict.
   */
  achieved: (obs: Observation) => boolean;
  /**
   * Verdicts a correctly isolated sandbox may produce for this attempt.
   *
   * Most attempts accept both 'blocked' and 'contained' because which one
   * happens depends on the layer under test: the blocklist layer refuses the
   * payload outright, the isolation layer admits it and the attack then fails
   * inside the realm. Neither is an escape. An attempt that must provably RUN
   * — to demonstrate realm separation rather than a lucky refusal — lists
   * only 'contained'.
   */
  expected: ContainmentVerdict[];
}

export interface EscapeTestResult {
  attempt: EscapeAttempt;
  layer: DefenceLayer;
  isolation: string;
  observation: Observation;
  actual: ContainmentVerdict;
  passed: boolean;
  details: string;
  durationMs: number;
}

export interface AdversarialSuiteResult {
  layer: DefenceLayer;
  isolation: string;
  total: number;
  passed: number;
  failed: number;
  escaped: number;
  contained: number;
  blocked: number;
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
