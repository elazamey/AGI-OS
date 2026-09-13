import { generateId, now } from '@agi-os/kernel';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import { CodeValidator } from './code-validator.js';
import type { SandboxConfig, SandboxExecution, SandboxResult, CodeLanguage } from './types.js';

const DEFAULT_CONFIG: Omit<SandboxConfig, 'id'> = {
  type: 'wasm',
  language: 'javascript',
  timeout: 5000,
  memoryLimit: 128,
  networkAccess: false,
  filesystemAccess: 'none',
  allowedModules: [],
};

export class SandboxManager {
  private sandboxes: Map<string, SandboxConfig> = new Map();
  private executions: Map<string, SandboxExecution> = new Map();
  private governance: GovernanceGateway;
  private codeValidator: CodeValidator;

  constructor(params?: { governance?: GovernanceGateway }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.codeValidator = new CodeValidator();
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

  async execute(sandboxId: string, code: string, language: CodeLanguage = 'javascript', stdin?: string): Promise<SandboxResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const validation = this.codeValidator.validate(code, sandbox.allowedModules);
    if (!validation.valid) {
      const execution: SandboxExecution = {
        id: generateId(), sandboxId, code, language, stdin,
        startedAt: now().toISOString(), completedAt: now().toISOString(),
        exitCode: 1, stderr: `Validation failed: ${validation.violations.map(v => v.description).join(', ')}`,
        duration: 0, timedOut: false, governanceDecision: PolicyDecision.BLOCK,
      };
      this.executions.set(execution.id, execution);
      return { execution, success: false, output: '', error: execution.stderr, duration: 0 };
    }

    const intent = { id: generateId(), module: 'sandbox', operation: 'process', target: `sandbox:${language}:${sandboxId}`, payload: { code: code.substring(0, 100), language } };
    const gate = this.governance.intercept(intent);

    const execution: SandboxExecution = {
      id: generateId(), sandboxId, code, language, stdin,
      startedAt: now().toISOString(), timedOut: false, governanceDecision: gate.decision,
    };

    if (gate.decision === PolicyDecision.BLOCK) {
      execution.completedAt = now().toISOString();
      execution.exitCode = 1;
      execution.stderr = `Blocked by governance: ${gate.auditRecord.matchedRuleId}`;
      execution.duration = 0;
      this.executions.set(execution.id, execution);
      return { execution, success: false, output: '', error: execution.stderr, duration: 0 };
    }

    if (gate.decision === PolicyDecision.REQUIRE_APPROVAL) {
      execution.completedAt = now().toISOString();
      execution.exitCode = 1;
      execution.stderr = 'Requires approval — not executed';
      execution.duration = 0;
      this.executions.set(execution.id, execution);
      return { execution, success: false, output: '', error: execution.stderr, duration: 0 };
    }

    const startTime = Date.now();
    try {
      const result = this.simulateExecution(code, language);
      execution.completedAt = now().toISOString();
      execution.exitCode = result.exitCode;
      execution.stdout = result.stdout;
      execution.stderr = result.stderr;
      execution.duration = Date.now() - startTime;
      this.executions.set(execution.id, execution);
      return { execution, success: result.exitCode === 0, output: result.stdout, error: result.stderr, duration: execution.duration };
    } catch (err: any) {
      execution.completedAt = now().toISOString();
      execution.exitCode = 1;
      execution.stderr = err.message;
      execution.duration = Date.now() - startTime;
      execution.timedOut = err.message.includes('timeout');
      this.executions.set(execution.id, execution);
      return { execution, success: false, output: '', error: err.message, duration: execution.duration };
    }
  }

  private simulateExecution(code: string, language: CodeLanguage): { exitCode: number; stdout: string; stderr: string } {
    if (language === 'javascript' || language === 'typescript') {
      try {
        let stdout = '';
        const fakeConsole = { log: (...args: any[]) => { stdout += args.join(' ') + '\n'; } };
        const fn = new Function('console', code);
        fn(fakeConsole);
        return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
      } catch (err: any) {
        return { exitCode: 1, stdout: '', stderr: err.message };
      }
    }
    return { exitCode: 0, stdout: `Executed ${language} code`, stderr: '' };
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
