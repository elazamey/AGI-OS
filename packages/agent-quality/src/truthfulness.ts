import type { TruthfulnessResult } from './types.js';

export class TruthfulnessClassifier {
  private knownFacts: Map<string, string> = new Map();
  private unknownCache: Set<string> = new Set();

  registerFact(key: string, value: string): void {
    this.knownFacts.set(key, value);
  }

  classify(claim: string, evidence?: string[]): TruthfulnessResult {
    const evidenceList = evidence ?? [];

    for (const [key, value] of this.knownFacts) {
      if (claim.toLowerCase().includes(key.toLowerCase())) {
        if (value.toLowerCase() === claim.toLowerCase() || claim.toLowerCase().includes(value.toLowerCase())) {
          return {
            claim,
            classification: 'KNOWN',
            confidence: 0.95,
            evidence: [`Known fact: ${key}=${value}`],
            reasoning: `Claim matches known fact`,
          };
        }
        return {
          claim,
          classification: 'FALSE',
          confidence: 0.9,
          evidence: [`Known fact contradicts: ${key}=${value}`],
          reasoning: `Claim contradicts known fact`,
        };
      }
    }

    if (evidenceList.length > 0) {
      const claimWords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const evidenceText = evidenceList.join(' ').toLowerCase();
      const supportedWords = claimWords.filter(w => evidenceText.includes(w));
      const supportRatio = claimWords.length > 0 ? supportedWords.length / claimWords.length : 0;
      if (supportRatio >= 0.3) {
        return {
          claim,
          classification: 'INFERRED',
          confidence: 0.5 + supportRatio * 0.3,
          evidence: evidenceList,
          reasoning: `Claim ${Math.round(supportRatio * 100)}% supported by evidence`,
        };
      }
      return {
        claim,
        classification: 'UNVERIFIED',
        confidence: 0.3,
        evidence: evidenceList,
        reasoning: 'Evidence exists but does not directly support claim',
      };
    }

    return {
      claim,
      classification: 'UNKNOWN',
      confidence: 0,
      evidence: [],
      reasoning: 'No evidence available to evaluate claim',
    };
  }

  checkFileExists(filePath: string): TruthfulnessResult {
    return {
      claim: `File ${filePath} exists`,
      classification: 'UNKNOWN',
      confidence: 0,
      evidence: [],
      reasoning: 'File existence not verified — filesystem scan required',
    };
  }

  checkSourceExists(sourceId: string): TruthfulnessResult {
    return this.classify(`Source ${sourceId} is available`);
  }

  validateConfidence(claim: string, claimedConfidence: number, evidenceCount: number): { adjusted: boolean; newConfidence: number; reason: string } {
    if (claimedConfidence > 0.9 && evidenceCount === 0) {
      return { adjusted: true, newConfidence: 0, reason: 'High confidence with zero evidence is unjustified' };
    }
    if (claimedConfidence > 0.8 && evidenceCount < 2) {
      return { adjusted: true, newConfidence: Math.min(claimedConfidence, 0.5), reason: 'Insufficient evidence for high confidence' };
    }
    return { adjusted: false, newConfidence: claimedConfidence, reason: 'Confidence level appropriate for evidence count' };
  }
}
