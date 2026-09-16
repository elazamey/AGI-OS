import { now } from '@agi-os/kernel';
import { EvidenceCollector } from './evidence.js';
import { Scorecard } from './scorecard.js';
import type { TestCase, GateResult, GateId, TestStatus, CertificationReport, TestEvidence, ReleaseDecision } from './types.js';

export class CertificationRunner {
  private testCases: Map<string, TestCase> = new Map();
  private evidence: EvidenceCollector;
  private scorecard: Scorecard;
  private gateRunners: Map<GateId, () => Promise<TestEvidence[]>> = new Map();

  constructor() {
    this.evidence = new EvidenceCollector();
    this.scorecard = new Scorecard();
  }

  registerTest(test: TestCase): void {
    this.testCases.set(test.id, test);
  }

  registerGate(gate: GateId, runner: () => Promise<TestEvidence[]>): void {
    this.gateRunners.set(gate, runner);
  }

  async runGate(gate: GateId): Promise<GateResult> {
    const start = Date.now();
    const runner = this.gateRunners.get(gate);
    const tests = Array.from(this.testCases.values()).filter(t => t.gate === gate);

    let evidence: TestEvidence[] = [];
    if (runner) {
      evidence = await runner();
    } else {
      evidence = tests.map(t => this.evidence.collect({
        testId: t.id,
        input: null,
        expected: 'PASS',
        actual: 'SKIPPED',
        status: 'SKIPPED',
        durationMs: 0,
      }));
    }

    const passed = evidence.filter(e => e.status === 'PASS').length;
    const failed = evidence.filter(e => e.status === 'FAIL').length;
    const blocked = evidence.filter(e => e.status === 'BLOCKED').length;
    const skipped = evidence.filter(e => e.status === 'SKIPPED').length;
    const total = evidence.length;
    const passRate = total > 0 ? passed / total : 0;
    const status: TestStatus = failed > 0 ? 'FAIL' : blocked > 0 ? 'BLOCKED' : 'PASS';

    const gateNames: Record<GateId, string> = {
      G0: 'Foundation', G1: 'Reasoning & Planning', G2: 'Tool & Skill Execution',
      G3: 'Browser Agent', G4: 'OS / Sandbox', G5: 'Coding Agent',
      G6: 'Research & Evidence', G7: 'Memory & Persistence', G8: 'Long-Horizon Autonomy',
      G9: 'Security & Governance', G10: 'Failure & Recovery', G11: 'Performance & Cost',
      G12: 'Frontend / Mission UX',
      G13: 'Agent Quality', G14: 'Trust & Reliability', G15: 'Long-Horizon / 2026 Eval',
      G16: 'Production Operations', G17: 'Benchmark Integrity', G18: 'Arabic / Multilingual',
      G19: 'Multi-Agent / Swarm', G20: 'Invariants & Contracts',
    };

    const result: GateResult = {
      gate,
      name: gateNames[gate],
      total,
      passed,
      failed,
      blocked,
      skipped,
      passRate,
      status,
      durationMs: Date.now() - start,
      evidence,
    };

    this.scorecard.recordGate(result);
    return result;
  }

  async runAll(): Promise<CertificationReport> {
    const start = Date.now();
    const gates: GateId[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G17', 'G18', 'G19', 'G20'];
    const gateResults: GateResult[] = [];

    for (const gate of gates) {
      gateResults.push(await this.runGate(gate));
    }

    const totalTests = gateResults.reduce((s, g) => s + g.total, 0);
    const totalPassed = gateResults.reduce((s, g) => s + g.passed, 0);
    const totalFailed = gateResults.reduce((s, g) => s + g.failed, 0);
    const totalBlocked = gateResults.reduce((s, g) => s + g.blocked, 0);
    const overallScore = totalTests > 0 ? totalPassed / totalTests : 0;

    const hasCriticalSecurity = gateResults.find(g => g.gate === 'G9')?.status === 'FAIL';
    const hasFoundationFail = gateResults.find(g => g.gate === 'G0')?.status === 'FAIL';
    const releaseDecision: ReleaseDecision = (hasCriticalSecurity || hasFoundationFail) ? 'BLOCKED' : overallScore >= 0.9 ? 'CERTIFIED' : 'CONDITIONAL';

    const criticalFindings: string[] = [];
    if (hasCriticalSecurity) criticalFindings.push('G9 Security gate failed');
    if (hasFoundationFail) criticalFindings.push('G0 Foundation gate failed');

    return {
      version: '1.5.0',
      gitSha: 'local',
      timestamp: now().toISOString(),
      environment: { node: 'v22', platform: 'win32', arch: 'x64' },
      gates: gateResults,
      overallScore,
      overallStatus: releaseDecision === 'CERTIFIED' ? 'PASS' : releaseDecision === 'BLOCKED' ? 'FAIL' : 'BLOCKED',
      totalTests,
      totalPassed,
      totalFailed,
      totalBlocked,
      criticalFindings,
      knownLimitations: [],
      releaseDecision,
      durationMs: Date.now() - start,
    };
  }

  getScorecard(): Scorecard { return this.scorecard; }
  getEvidence(): EvidenceCollector { return this.evidence; }
}
