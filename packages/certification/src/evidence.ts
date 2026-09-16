import { now } from '@agi-os/kernel';
import type { TestEvidence, TestStatus } from './types.js';

export class EvidenceCollector {
  private evidence: TestEvidence[] = [];

  collect(params: {
    testId: string;
    input: unknown;
    expected: unknown;
    actual: unknown;
    status: TestStatus;
    durationMs: number;
    logs?: string[];
    artifacts?: string[];
  }): TestEvidence {
    const evidence: TestEvidence = {
      testId: params.testId,
      timestamp: now().toISOString(),
      gitSha: 'local',
      input: params.input,
      expected: params.expected,
      actual: params.actual,
      status: params.status,
      durationMs: params.durationMs,
      logs: params.logs || [],
      artifacts: params.artifacts || [],
      evidenceHash: '',
    };
    evidence.evidenceHash = this.hashEvidence(evidence);
    this.evidence.push(evidence);
    return evidence;
  }

  private hashEvidence(evidence: TestEvidence): string {
    const data = `${evidence.testId}:${evidence.expected}:${evidence.actual}:${evidence.status}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  getEvidence(): TestEvidence[] { return [...this.evidence]; }
  getByTest(testId: string): TestEvidence[] { return this.evidence.filter(e => e.testId === testId); }
  getByStatus(status: TestStatus): TestEvidence[] { return this.evidence.filter(e => e.status === status); }
  getStats(): { total: number; byStatus: Record<string, number> } {
    const byStatus: Record<string, number> = {};
    for (const e of this.evidence) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    return { total: this.evidence.length, byStatus };
  }
  reset(): void { this.evidence = []; }
}
