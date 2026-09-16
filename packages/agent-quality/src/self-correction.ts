import type { SelfCorrectionResult } from './types.js';

export class SelfCorrectionEvaluator {
  evaluate(
    initialAssumption: string,
    contradictingEvidence: string,
    finalBehavior: string,
  ): SelfCorrectionResult {
    const corrected = !finalBehavior.toLowerCase().includes(initialAssumption.toLowerCase()) ||
      finalBehavior.toLowerCase().includes('corrected') ||
      finalBehavior.toLowerCase().includes('revised');

    const correctionPath: SelfCorrectionResult['correctionPath'] = ['assumption', 'observation'];

    if (contradictingEvidence) {
      correctionPath.push('contradiction');
    }
    if (corrected) {
      correctionPath.push('correction');
    }

    return {
      initialAssumption,
      contradictingEvidence,
      corrected,
      correctionPath,
      timeToCorrect: corrected ? 1 : 0,
    };
  }

  detectAssumptionViolation(
    assumptions: string[],
    observations: string[],
  ): { violated: string[]; preserved: string[] } {
    const violated: string[] = [];
    const preserved: string[] = [];

    for (const assumption of assumptions) {
      const assumptionLower = assumption.toLowerCase();
      const contradicted = observations.some(obs => {
        const obsLower = obs.toLowerCase();
        return assumptionLower.split(/\s+/).some(word =>
          word.length > 3 && obsLower.includes(word)
        ) && !obsLower.includes(assumptionLower);
      });

      if (contradicted) violated.push(assumption);
      else preserved.push(assumption);
    }

    return { violated, preserved };
  }

  getCorrectionRate(results: SelfCorrectionResult[]): number {
    if (results.length === 0) return 0;
    const corrected = results.filter(r => r.corrected).length;
    return corrected / results.length;
  }
}
