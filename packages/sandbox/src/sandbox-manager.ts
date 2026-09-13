// ============================================================================
// AGI OS - Sandbox Manager
// ----------------------------------------------------------------------------
// Guest code is handed to a real isolation boundary (see ./isolation). The
// previous implementation ran it with `new Function(code)` in the host realm
// while storing `timeout` / `memoryLimit` / `networkAccess` and applying none
// of them; that allowed a guest to read the host's `process.env`.
//
// Two invariants this class now holds:
//   1. Declared limits are enforced, or reported as `unenforcedLimits`.
//   2. A language with no executor is a hard failure, never a faked success.
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import { CodeValidator } from './code-validator.js';
import { VmExecutor } from './isolation/vm-executor.js';
import { SubprocessExecutor } from './isolation/subprocess-executor.js';
import type { IsolatedExecutor, IsolationLevel } from './isolation/types.js';
import type { SandboxConfig, SandboxExecution, SandboxResult, CodeLanguage } from './types.js';

const DEFAULT_CONFIG: Omit<SandboxConfig, 'id'> = {
  type: 'wasm',
  language: 'javascript',
  timeout: 5000,
  memoryLimit: 128,
  networkAccess: false,
  filesystemAccess: 'none',
  allowedModules: [],
  isolation: 'vm',
};

/** Cap on retained execution records so a long-lived manager cannot leak. */
const MAX_RETAINED_EXECUTIONS = 1000;

/** Languages that actually have an executor. Anything else must fail loudly. */
const EXECUTABLE_LANGUAGES: ReadonlySet<CodeLanguage> = new Set<CodeLanguage>(['javascript', 'typescript']);

export class SandboxManager {
  private sandboxes: Map<string, SandboxConfig> = new Map();
  private executions: Map<string, SandboxExecution> = new Map();
  private governance: GovernanceGateway;
  private codeValidator: CodeValidator;
  private executors: Map<IsolationLevel, IsolatedExecutor>;

  constructor(params?: { governance?: GovernanceGateway; executors?: Partial<Record<IsolationLevel, IsolatedExecutor>> }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.codeValidator = new CodeValidator();
    this.executors = new Map<IsolationLevel, IsolatedExecutor>([
      ['vm', params?.executors?.vm ?? new VmExecutor()],
      ['subprocess', params?.executors?.subprocess ?? new SubprocessExecutor()],
      // `worker` is accepted as an alias for the strongest in-process option
      // until a dedicated worker executor exists; it never silently downgrades.
      ['worker', params?.executors?.worker ?? params?.executors?.subprocess ?? new SubprocessExecutor()],
    ]);
  }

  createSandbox(config?: Partial<SandboxConfig>): SandboxConfig {
    const sandbox: SandboxConfig = { id: generateId(), ...DEFAULT_CONFIG, ...config };
    this.sandboxes.set(sandbox.id, sandbox);
    return sandbox;
  }

  destroySandbox(sandboxId: string): boolean {
    return this.sandboxes.delete(sandboxId);
  }

  getSandbox(sandboxId: string): SandboxConfig | undefined {
    return this.sandboxes.get(sandboxId);
  }

  getAllSandboxes(): SandboxConfig[] {
    return [...this.sandboxes.values()];
  }

  /** Which isolation boundary a given level maps to, and what it guarantees. */
  describeIsolation(level: IsolationLevel = 'vm'): string {
    return this.executors.get(level)?.describe() ?? `no executor registered for "${level}"`;
  }

  async execute(sandboxId: string, code: string, language: CodeLanguage = 'javascript', stdin?: string): Promise<SandboxResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const validation = this.codeValidator.validate(code, sandbox.allowedModules);
    if (!validation.valid) {
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: `Validation failed: ${validation.violations.map(v => v.description).join(', ')}`,
        timedOut: false,
        governanceDecision: PolicyDecision.BLOCK,
        isolation: sandbox.isolation,
        unenforcedLimits: [],
        success: false,
      });
    }

    // Fail closed: refuse rather than pretend to run a language we cannot run.
    if (!EXECUTABLE_LANGUAGES.has(language)) {
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: `Unsupported language "${language}": no isolated executor is registered for it. Refusing to fake success.`,
        timedOut: false,
        governanceDecision: PolicyDecision.BLOCK,
        isolation: sandbox.isolation,
        unenforcedLimits: [],
        success: false,
      });
    }

    // NOTE: `module: 'sandbox'` is intentional. Reclassifying this to 'exec'
    // would make the RiskEvaluator score every sandbox run HIGH and force
    // REQUIRE_APPROVAL, which is a governance-taxonomy decision tracked as
    // P1.2 in docs/EXECUTION_PLAN.md — not something to change silently here.
    const intent = {
      id: generateId(),
      module: 'sandbox',
      operation: 'process',
      target: `sandbox:${language}:${sandboxId}`,
      payload: { codePreview: code.substring(0, 100), language, isolation: sandbox.isolation },
    };
    const gate = this.governance.intercept(intent);

    if (gate.decision === PolicyDecision.BLOCK) {
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: `Blocked by governance: ${gate.auditRecord.matchedRuleId ?? gate.riskAssessment.reason}`,
        timedOut: false,
        governanceDecision: gate.decision,
        isolation: sandbox.isolation,
        unenforcedLimits: [],
        success: false,
      });
    }

    if (gate.decision === PolicyDecision.REQUIRE_APPROVAL) {
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: 'Requires approval — not executed',
        timedOut: false,
        governanceDecision: gate.decision,
        isolation: sandbox.isolation,
        unenforcedLimits: [],
        success: false,
      });
    }

    const executor = this.executors.get(sandbox.isolation);
    if (!executor) {
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: `No executor registered for isolation level "${sandbox.isolation}"`,
        timedOut: false,
        governanceDecision: gate.decision,
        isolation: sandbox.isolation,
        unenforcedLimits: [`isolation:${sandbox.isolation} unavailable`],
        success: false,
      });
    }

    const startTime = Date.now();
    try {
      const result = await executor.execute({
        code,
        language,
        timeoutMs: Math.max(1, sandbox.timeout),
        maxMemoryMb: Math.max(0, sandbox.memoryLimit),
        networkAccess: sandbox.networkAccess,
        filesystemAccess: sandbox.filesystemAccess,
        // Deliberately empty: the guest never sees the host environment.
        env: {},
      });

      return this.record({
        sandboxId, code, language, stdin,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        killed: result.killed,
        governanceDecision: gate.decision,
        isolation: result.isolation,
        unenforcedLimits: result.unenforced,
        duration: Date.now() - startTime,
        success: result.exitCode === 0 && !result.timedOut,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this.record({
        sandboxId, code, language, stdin,
        exitCode: 1,
        stderr: message,
        timedOut: /timeout|timed out/i.test(message),
        governanceDecision: gate.decision,
        isolation: sandbox.isolation,
        unenforcedLimits: [],
        duration: Date.now() - startTime,
        success: false,
      });
    }
  }

  // ---- internals ----------------------------------------------------------

  private record(fields: {
    sandboxId: string;
    code: string;
    language: CodeLanguage;
    stdin?: string;
    exitCode: number;
    stdout?: string;
    stderr?: string;
    timedOut: boolean;
    killed?: boolean;
    governanceDecision: PolicyDecision;
    isolation: IsolationLevel;
    unenforcedLimits: string[];
    duration?: number;
    success: boolean;
  }): SandboxResult {
    const startedAt = now().toISOString();
    const execution: SandboxExecution = {
      id: generateId(),
      sandboxId: fields.sandboxId,
      code: fields.code,
      language: fields.language,
      stdin: fields.stdin,
      startedAt,
      completedAt: now().toISOString(),
      exitCode: fields.exitCode,
      stdout: fields.stdout ?? '',
      stderr: fields.stderr ?? '',
      duration: fields.duration ?? 0,
      timedOut: fields.timedOut,
      killed: fields.killed ?? false,
      governanceDecision: fields.governanceDecision,
      isolation: fields.isolation,
      unenforcedLimits: fields.unenforcedLimits,
    };

    this.executions.set(execution.id, execution);
    this.evictOldExecutions();

    return {
      execution,
      success: fields.success,
      output: execution.stdout ?? '',
      error: execution.stderr || undefined,
      duration: execution.duration ?? 0,
    };
  }

  /** Bounded retention: oldest first, so the map cannot grow without limit. */
  private evictOldExecutions(): void {
    if (this.executions.size <= MAX_RETAINED_EXECUTIONS) return;
    const excess = this.executions.size - MAX_RETAINED_EXECUTIONS;
    let removed = 0;
    for (const key of this.executions.keys()) {
      if (removed >= excess) break;
      this.executions.delete(key);
      removed++;
    }
  }

  getExecution(executionId: string): SandboxExecution | undefined {
    return this.executions.get(executionId);
  }

  getExecutionsBySandbox(sandboxId: string): SandboxExecution[] {
    return [...this.executions.values()].filter(e => e.sandboxId === sandboxId);
  }

  getAllExecutions(): SandboxExecution[] {
    return [...this.executions.values()];
  }

  getCodeValidator(): CodeValidator {
    return this.codeValidator;
  }
}
