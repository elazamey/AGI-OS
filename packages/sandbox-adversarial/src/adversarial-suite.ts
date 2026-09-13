import { now } from '@agi-os/kernel';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import { SandboxEnforcer } from './sandbox-enforcer.js';
import type { EscapeAttempt, EscapeTestResult, AdversarialSuiteResult, SandboxConfig } from './types.js';
import { ESCAPE_ATTEMPTS } from './escape-attempts.js';

export class AdversarialSuite {
  private governance: GovernanceGateway;
  private enforcer: SandboxEnforcer;
  private results: EscapeTestResult[] = [];

  constructor(params?: { governance?: GovernanceGateway; config?: Partial<SandboxConfig> }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.enforcer = new SandboxEnforcer(params?.config);
  }

  runAttempt(attempt: EscapeAttempt): EscapeTestResult {
    const start = Date.now();
    const intent = { id: attempt.id, module: attempt.category === 'filesystem' ? 'fs' : attempt.category === 'network' ? 'network' : 'exec', operation: 'execute', target: attempt.payload };
    const gateResult = this.governance.intercept(intent);
    const isBlocked = gateResult.decision === PolicyDecision.BLOCK;

    let actual: 'blocked' | 'escaped' | 'contained';
    if (isBlocked) {
      actual = 'blocked';
    } else if (gateResult.decision === PolicyDecision.REQUIRE_APPROVAL) {
      actual = 'contained';
    } else {
      actual = 'escaped';
    }

    const capCheck = this.enforcer.checkCapability(`${attempt.category}.execute`);
    if (!capCheck.allowed && actual !== 'blocked') {
      actual = 'blocked';
    }

    return {
      attempt,
      actual,
      passed: actual === attempt.expected,
      details: `Governance: ${gateResult.decision}, Capability: ${capCheck.allowed ? 'allowed' : 'denied'}`,
      durationMs: Date.now() - start,
    };
  }

  runAll(): AdversarialSuiteResult {
    const start = Date.now();
    this.results = ESCAPE_ATTEMPTS.map(a => this.runAttempt(a));
    const passed = this.results.filter(r => r.passed).length;
    const escaped = this.results.filter(r => r.actual === 'escaped').length;
    const contained = this.results.filter(r => r.actual === 'contained').length;

    return {
      total: this.results.length,
      passed,
      failed: this.results.length - passed,
      escaped,
      contained,
      results: this.results,
      durationMs: Date.now() - start,
      timestamp: now().toISOString(),
    };
  }

  getResults(): EscapeTestResult[] { return [...this.results]; }
  getBreaches(): EscapeTestResult[] { return this.results.filter(r => r.actual === 'escaped'); }
  getEnforcer(): SandboxEnforcer { return this.enforcer; }
}
