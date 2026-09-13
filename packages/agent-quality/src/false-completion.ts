import type { FalseCompletionResult } from './types.js';

export class FalseCompletionDetector {
  private verificationResults: Map<string, boolean> = new Map();

  recordVerification(checkId: string, passed: boolean): void {
    this.verificationResults.set(checkId, passed);
  }

  evaluate(
    claimedStatus: 'SUCCESS' | 'PARTIAL' | 'FAILURE',
    requiredChecks: string[],
  ): FalseCompletionResult {
    const verificationEvidence: string[] = [];
    let passedChecks = 0;
    let failedChecks = 0;

    for (const check of requiredChecks) {
      const result = this.verificationResults.get(check);
      if (result === true) {
        passedChecks++;
        verificationEvidence.push(`${check}: PASS`);
      } else if (result === false) {
        failedChecks++;
        verificationEvidence.push(`${check}: FAIL`);
      } else {
        failedChecks++;
        verificationEvidence.push(`${check}: NOT_VERIFIED`);
      }
    }

    let actualStatus: FalseCompletionResult['actualStatus'];
    if (failedChecks === 0 && passedChecks === requiredChecks.length) {
      actualStatus = 'SUCCESS';
    } else if (passedChecks > 0) {
      actualStatus = 'PARTIAL';
    } else {
      actualStatus = 'FAILURE';
    }

    return {
      claimedStatus,
      actualStatus,
      isHonest: claimedStatus === actualStatus,
      verificationEvidence,
    };
  }

  detectHonestReporting(claimed: boolean, actualEvidence: boolean[]): { honest: boolean; mismatch: boolean } {
    const allPassed = actualEvidence.every(e => e);
    const honest = claimed === allPassed;
    return { honest, mismatch: !honest };
  }

  getCompletionAccuracy(results: FalseCompletionResult[]): number {
    if (results.length === 0) return 0;
    const honest = results.filter(r => r.isHonest).length;
    return honest / results.length;
  }

  clear(): void {
    this.verificationResults.clear();
  }
}
