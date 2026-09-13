import type { UncertaintyPropagationResult } from './types.js';

export class UncertaintyPropagator {
  propagate(steps: { stepId: string; inputConfidence: number; outputConfidence: number }[]): UncertaintyPropagationResult {
    const finalConfidence = steps.length > 0 ? steps[steps.length - 1].outputConfidence : 0;

    let propagatedCorrectly = true;
    let inflatedConfidence = false;

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];
      if (curr.outputConfidence > prev.outputConfidence + 0.3) {
        inflatedConfidence = true;
      }
      if (curr.inputConfidence !== prev.outputConfidence) {
        propagatedCorrectly = false;
      }
    }

    if (steps.length === 1 && steps[0].outputConfidence > steps[0].inputConfidence + 0.3) {
      inflatedConfidence = true;
    }

    return { steps, finalConfidence, propagatedCorrectly, inflatedConfidence };
  }

  detectConfidenceAbuse(
    claimedConfidence: number,
    evidenceCount: number,
    sourceQuality: number,
  ): { abuseDetected: boolean; adjustedConfidence: number; reason: string } {
    if (claimedConfidence > 0.9 && evidenceCount < 2) {
      return { abuseDetected: true, adjustedConfidence: 0.5, reason: 'High confidence with insufficient evidence' };
    }
    if (claimedConfidence > sourceQuality + 0.3) {
      return { abuseDetected: true, adjustedConfidence: sourceQuality, reason: 'Confidence exceeds source quality' };
    }
    return { abuseDetected: false, adjustedConfidence: claimedConfidence, reason: 'Confidence level appropriate' };
  }
}
