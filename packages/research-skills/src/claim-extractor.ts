import { generateId } from '@agi-os/kernel';
import type { Claim, Evidence } from './types.js';

export class ClaimExtractor {
  extract(text: string, sourceId: string): Claim[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.map(sentence => ({
      id: generateId(),
      text: sentence.trim(),
      evidence: [{ sourceId, text: sentence.trim(), relevance: 0.8, supports: true }],
      confidence: 0.7,
      sources: [sourceId],
    }));
  }

  crossVerify(claims: Claim[]): Claim[] {
    return claims.map(claim => {
      const supportCount = claim.evidence.filter(e => e.supports).length;
      const totalEvidence = claim.evidence.length;
      return { ...claim, confidence: totalEvidence > 0 ? supportCount / totalEvidence : 0 };
    });
  }

  detectContradictions(claims: Claim[]): Array<{ claim1: string; claim2: string; reason: string }> {
    const contradictions: Array<{ claim1: string; claim2: string; reason: string }> = [];
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i].text.toLowerCase();
        const b = claims[j].text.toLowerCase();
        if (a.includes('not') && b.includes(a.replace('not ', '')) || b.includes('not') && a.includes(b.replace('not ', ''))) {
          contradictions.push({ claim1: claims[i].id, claim2: claims[j].id, reason: 'Opposing claims detected' });
        }
      }
    }
    return contradictions;
  }
}
