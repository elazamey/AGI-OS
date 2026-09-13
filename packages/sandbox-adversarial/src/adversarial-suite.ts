// ============================================================================
// AGI OS - Adversarial Suite (real execution)
// ----------------------------------------------------------------------------
// Runs every hostile payload against the ACTUAL sandbox and measures whether
// the attacker achieved their goal. Two layers are tested:
//
//   blocklist   through SandboxManager — source validation + governance +
//               isolation, i.e. everything a normal caller goes through.
//   isolation   directly into the executor, deliberately bypassing the
//               CodeValidator. This is the layer that matters: a regex
//               blocklist is a convenience, not a boundary, and the CI job for
//               this package exists to prove the boundary holds without it.
//
// Imports come from the BUILT @agi-os/sandbox artifact, not from its source, so
// a build-time difference cannot hide an escape.
// ============================================================================

import { now } from '@agi-os/kernel';
import {
  SandboxManager,
  VmExecutor,
  SubprocessExecutor,
  type IsolationLevel,
  type IsolationRequest,
  type SandboxResult,
} from '@agi-os/sandbox';
import type {
  AdversarialSuiteResult,
  ContainmentVerdict,
  DefenceLayer,
  EscapeAttempt,
  EscapeTestResult,
  Observation,
} from './types.js';
import { ESCAPE_ATTEMPTS } from './escape-attempts.js';
import { SandboxEnforcer } from './sandbox-enforcer.js';

/** Stderr prefixes that mean the guest was never admitted. */
const REFUSAL_PREFIXES = [
  'Validation failed:',
  'Unsupported language',
  'Blocked by governance:',
  'Requires approval',
  'No executor registered',
] as const;

export interface AdversarialSuiteOptions {
  /** Which defence layer to attack. Both by default (see runAll). */
  layer?: DefenceLayer;
  /** Isolation boundary under test. */
  isolation?: IsolationLevel;
  /** Per-attempt CPU budget. Kept short: one payload is an infinite loop. */
  timeoutMs?: number;
  maxMemoryMb?: number;
  attempts?: EscapeAttempt[];
  enforcer?: SandboxEnforcer;
}

export class AdversarialSuite {
  private readonly layer: DefenceLayer;
  private readonly isolation: IsolationLevel;
  private readonly timeoutMs: number;
  private readonly maxMemoryMb: number;
  private readonly attempts: EscapeAttempt[];
  private readonly enforcer: SandboxEnforcer;
  private results: EscapeTestResult[] = [];

  constructor(options: AdversarialSuiteOptions = {}) {
    this.layer = options.layer ?? 'isolation';
    this.isolation = options.isolation ?? 'vm';
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.maxMemoryMb = options.maxMemoryMb ?? 64;
    this.attempts = options.attempts ?? ESCAPE_ATTEMPTS;
    this.enforcer = options.enforcer ?? new SandboxEnforcer();
  }

  // ---------------------------------------------------------------------------
  // Single attempt
  // ---------------------------------------------------------------------------
  async runAttempt(attempt: EscapeAttempt, layer: DefenceLayer = this.layer): Promise<EscapeTestResult> {
    const start = Date.now();
    const pollutedBefore = hostPrototypePolluted();

    let observation: Observation;
    try {
      observation =
        layer === 'blocklist'
          ? await this.viaManager(attempt)
          : await this.viaExecutor(attempt);
    } catch (err) {
      // A harness failure is not containment. Report it as such instead of
      // silently counting it as a pass — that mistake is what made the previous
      // version of this suite tautological.
      observation = {
        ran: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        timedOut: false,
        killed: false,
        unenforced: [],
        harnessError: err instanceof Error ? err.message : String(err),
      };
    }

    observation.hostPolluted = hostPrototypePolluted() && !pollutedBefore;

    const durationMs = Date.now() - start;

    // A predicate that throws is a broken oracle, not a contained attack. It
    // must surface as a failure; counting it as a pass is precisely the error
    // that made the previous version of this suite report 18/18 while executing
    // nothing at all.
    let actual: ContainmentVerdict;
    try {
      actual = this.classify(attempt, observation);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      observation.harnessError = `verdict predicate threw: ${message}`;
      return {
        attempt,
        layer,
        isolation: this.isolation,
        observation,
        actual: 'escaped',
        passed: false,
        details: this.describe('escaped', observation),
        durationMs,
      };
    }

    return {
      attempt,
      layer,
      isolation: this.isolation,
      observation,
      actual,
      passed: attempt.expected.includes(actual),
      details: this.describe(actual, observation),
      durationMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Whole set
  // ---------------------------------------------------------------------------
  async runAll(options: { layer?: DefenceLayer } = {}): Promise<AdversarialSuiteResult> {
    const layer = options.layer ?? this.layer;
    const start = Date.now();
    this.results = [];

    for (const attempt of this.attempts) {
      this.results.push(await this.runAttempt(attempt, layer));
    }

    return this.summarise(layer, Date.now() - start);
  }

  /** Attack both layers and merge the reports — the full acceptance run. */
  async runEveryLayer(): Promise<AdversarialSuiteResult[]> {
    const layers: DefenceLayer[] = ['blocklist', 'isolation'];
    const reports: AdversarialSuiteResult[] = [];
    for (const layer of layers) reports.push(await this.runAll({ layer }));
    return reports;
  }

  private summarise(layer: DefenceLayer, durationMs: number): AdversarialSuiteResult {
    const count = (v: ContainmentVerdict) => this.results.filter((r) => r.actual === v).length;
    return {
      layer,
      isolation: this.isolation,
      total: this.results.length,
      passed: this.results.filter((r) => r.passed).length,
      failed: this.results.filter((r) => !r.passed).length,
      escaped: count('escaped'),
      contained: count('contained'),
      blocked: count('blocked'),
      results: [...this.results],
      durationMs,
      timestamp: now().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Verdict — derived from the observation, never assumed
  // ---------------------------------------------------------------------------
  private classify(attempt: EscapeAttempt, obs: Observation): ContainmentVerdict {
    if (attempt.achieved(obs)) return 'escaped';
    return obs.ran ? 'contained' : 'blocked';
  }

  private describe(actual: ContainmentVerdict, obs: Observation): string {
    const parts = [`verdict=${actual}`, `ran=${obs.ran}`, `exit=${obs.exitCode}`];
    if (obs.timedOut) parts.push('timedOut');
    if (obs.killed) parts.push('killed');
    if (obs.hostPolluted) parts.push('HOST_PROTOTYPE_POLLUTED');
    if (obs.harnessError) parts.push(`harnessError=${obs.harnessError}`);
    if (obs.unenforced.length > 0) parts.push(`unenforced=${obs.unenforced.length}`);
    const evidence = (obs.stdout || obs.stderr).replace(/\s+/g, ' ').trim().slice(0, 120);
    if (evidence) parts.push(`output="${evidence}"`);
    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Execution paths
  // ---------------------------------------------------------------------------
  /** Full stack: CodeValidator + governance + isolation. */
  private async viaManager(attempt: EscapeAttempt): Promise<Observation> {
    const manager = new SandboxManager();
    const sandbox = manager.createSandbox({
      language: attempt.language ?? 'javascript',
      timeout: this.timeoutMs,
      memoryLimit: this.maxMemoryMb,
      networkAccess: false,
      filesystemAccess: 'none',
      allowedModules: [],
      isolation: this.isolation,
    });

    const language = attempt.language ?? 'javascript';
    const result: SandboxResult = await manager.execute(sandbox.id, attempt.payload, language);
    manager.destroySandbox(sandbox.id);

    const stderr = result.error ?? result.execution.stderr ?? '';
    return {
      ran: !REFUSAL_PREFIXES.some((p) => stderr.startsWith(p)),
      exitCode: result.execution.exitCode ?? (result.success ? 0 : 1),
      stdout: result.output ?? '',
      stderr,
      timedOut: result.execution.timedOut,
      killed: result.execution.killed ?? false,
      unenforced: result.execution.unenforcedLimits ?? [],
    };
  }

  /** Isolation only — the CodeValidator is bypassed on purpose. */
  private async viaExecutor(attempt: EscapeAttempt): Promise<Observation> {
    const executor =
      this.isolation === 'vm' ? new VmExecutor() : new SubprocessExecutor();

    const request: IsolationRequest = {
      code: attempt.payload,
      language: attempt.language ?? 'javascript',
      timeoutMs: this.timeoutMs,
      maxMemoryMb: this.maxMemoryMb,
      networkAccess: false,
      filesystemAccess: 'none',
    };

    const result = await executor.execute(request);
    return {
      // The executor always admits the code; whether it survives is the finding.
      ran: true,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      killed: result.killed,
      unenforced: result.unenforced,
    };
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------
  getResults(): EscapeTestResult[] {
    return [...this.results];
  }

  /** Attempts where the attacker actually won. Must always be empty. */
  getBreaches(): EscapeTestResult[] {
    return this.results.filter((r) => r.actual === 'escaped');
  }

  getEnforcer(): SandboxEnforcer {
    return this.enforcer;
  }

  /** Human-readable report — what CI prints on failure. */
  formatReport(report: AdversarialSuiteResult): string {
    const lines = [
      `adversarial suite — layer=${report.layer} isolation=${report.isolation}`,
      `  total=${report.total} passed=${report.passed} failed=${report.failed}`,
      `  escaped=${report.escaped} contained=${report.contained} blocked=${report.blocked}`,
      `  duration=${report.durationMs}ms`,
    ];
    for (const r of report.results) {
      const mark = r.passed ? 'ok  ' : 'FAIL';
      lines.push(`  [${mark}] ${r.attempt.id} ${r.attempt.name}: ${r.actual} (acceptable: ${r.attempt.expected.join('|')})`);
      if (!r.passed) {
        lines.push(`         goal: ${r.attempt.goal}`);
        lines.push(`         ${r.details}`);
      }
    }
    return lines.join('\n');
  }
}

/**
 * Did the guest mutate the HOST realm's Object.prototype?
 * This is measured on the host after execution — the only honest way to test
 * realm separation for prototype pollution.
 */
function hostPrototypePolluted(): boolean {
  return (Object.prototype as Record<string, unknown>).agiPolluted !== undefined;
}
