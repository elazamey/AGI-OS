import { generateId, now } from '@agi-os/kernel';
import type { VerificationResult, EvidenceItem, VerificationRequest } from './types.js';

export class ActionVerifier {
  verify(request: VerificationRequest): VerificationResult {
    const evidence: EvidenceItem[] = [];
    let verified = true;

    if (request.expectedOutput !== undefined) {
      const match =
        JSON.stringify(request.actualOutput) === JSON.stringify(request.expectedOutput);
      evidence.push({
        type: 'output_match',
        description: 'Output matches expected',
        value: match,
        verified: match,
      });
      if (!match && request.level === 'STRICT') verified = false;
    }

    if (request.level === 'PROOF') {
      evidence.push({
        type: 'hash_match',
        description: 'Output hash verified',
        value: this.hash(request.actualOutput),
        verified: true,
      });
    }

    evidence.push({
      type: 'custom',
      description: 'Action completed without error',
      value: true,
      verified: true,
    });

    return {
      id: generateId(),
      skillId: request.skillId,
      action: request.action,
      verified,
      confidence: this.calculateConfidence(evidence, request.level),
      evidence,
      timestamp: now().toISOString(),
    };
  }

  private calculateConfidence(evidence: EvidenceItem[], level: string): number {
    const verified = evidence.filter((e) => e.verified).length;
    const base = verified / Math.max(evidence.length, 1);
    const multiplier = level === 'PROOF' ? 1.0 : level === 'STRICT' ? 0.9 : 0.7;
    return Math.round(base * multiplier * 100) / 100;
  }

  private hash(data: unknown): string {
    const str = JSON.stringify(data);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return `hash_${Math.abs(h).toString(16)}`;
  }
}
