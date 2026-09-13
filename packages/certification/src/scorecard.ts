import type { GateResult, GateId, TestStatus } from './types.js';

export class Scorecard {
  private gates: Map<GateId, GateResult> = new Map();

  recordGate(result: GateResult): void {
    this.gates.set(result.gate, result);
  }

  getGate(gate: GateId): GateResult | undefined {
    return this.gates.get(gate);
  }

  getAllGates(): GateResult[] {
    return Array.from(this.gates.values()).sort((a, b) => a.gate.localeCompare(b.gate));
  }

  getOverallScore(): number {
    const gates = this.getAllGates();
    if (gates.length === 0) return 0;
    const totalTests = gates.reduce((sum, g) => sum + g.total, 0);
    const totalPassed = gates.reduce((sum, g) => sum + g.passed, 0);
    return totalTests > 0 ? totalPassed / totalTests : 0;
  }

  getOverallStatus(): TestStatus {
    const gates = this.getAllGates();
    if (gates.some(g => g.status === 'FAIL')) return 'FAIL';
    if (gates.every(g => g.status === 'PASS')) return 'PASS';
    return 'BLOCKED';
  }

  getGatePassRates(): Record<GateId, number> {
    const rates = {} as Record<GateId, number>;
    for (const [gate, result] of this.gates) {
      rates[gate] = result.passRate;
    }
    return rates;
  }

  hasCriticalFailures(): boolean {
    return this.getAllGates().some(g => g.status === 'FAIL' && g.evidence.some(e => e.status === 'FAIL'));
  }

  getSummary(): {
    totalGates: number;
    passedGates: number;
    failedGates: number;
    overallScore: number;
    overallStatus: TestStatus;
  } {
    const gates = this.getAllGates();
    return {
      totalGates: gates.length,
      passedGates: gates.filter(g => g.status === 'PASS').length,
      failedGates: gates.filter(g => g.status === 'FAIL').length,
      overallScore: this.getOverallScore(),
      overallStatus: this.getOverallStatus(),
    };
  }
}
