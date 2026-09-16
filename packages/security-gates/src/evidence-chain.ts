import { generateId, now, hash } from '@agi-os/kernel';
import type { EvidenceRecord } from './types.js';

export class EvidenceChain {
  private records: EvidenceRecord[] = [];

  record(params: {
    missionId: string;
    executionId: string;
    agentId: string;
    tool: string;
    input: string;
    output: string;
    policyDecision: string;
    result: string;
  }): EvidenceRecord {
    const parentEventId = this.records.length > 0 ? this.records[this.records.length - 1].id : undefined;
    const record: EvidenceRecord = {
      id: generateId(),
      missionId: params.missionId,
      executionId: params.executionId,
      agentId: params.agentId,
      tool: params.tool,
      inputHash: hash(params.input),
      outputHash: hash(params.output),
      policyDecision: params.policyDecision,
      timestamp: now().toISOString(),
      result: params.result,
      parentEventId,
    };
    this.records.push(record);
    return record;
  }

  verify(): { valid: boolean; brokenAt?: number } {
    for (let i = 1; i < this.records.length; i++) {
      if (this.records[i].parentEventId !== this.records[i - 1].id) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  }

  getRecords(): EvidenceRecord[] { return [...this.records]; }
  getRecordsFor(missionId: string): EvidenceRecord[] { return this.records.filter(r => r.missionId === missionId); }
  count(): number { return this.records.length; }
  clear(): void { this.records = []; }
}
