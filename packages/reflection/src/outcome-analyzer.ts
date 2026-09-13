// ============================================================================
// AGI OS - Outcome Analyzer
// Compares expected vs actual outcomes to detect discrepancies
// ============================================================================

import { generateId } from '@agi-os/kernel';
import type {
  MissionOutcome,
  Discrepancy,
  DiscrepancySeverity,
  ReflectionInput,
} from './types.js';

// ---------------------------------------------------------------------------
// Outcome Analyzer — compares expected vs actual
// ---------------------------------------------------------------------------
export class OutcomeAnalyzer {
  /**
   * Analyze a mission outcome from reflection input
   */
  analyze(input: ReflectionInput): MissionOutcome {
    return {
      missionId: input.missionId,
      goalId: input.goalId,
      goal: input.goal,
      planId: input.planId,
      predictedSuccess: input.predictedSuccess,
      predictedRisk: input.predictedRisk,
      expectedOutcome: input.expectedOutcome,
      actualOutcome: input.actualOutcome,
      success: input.success,
      duration: input.duration,
      evidenceRefs: input.evidenceRefs,
      timestamp: input.timestamp,
    };
  }

  /**
   * Detect discrepancies between expected and actual outcomes
   */
  detectDiscrepancies(outcome: MissionOutcome): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    // 1. Success/failure discrepancy
    const successDiscrepancy = this.checkSuccessDiscrepancy(outcome);
    if (successDiscrepancy) discrepancies.push(successDiscrepancy);

    // 2. Prediction accuracy discrepancy
    const predictionDiscrepancy = this.checkPredictionDiscrepancy(outcome);
    if (predictionDiscrepancy) discrepancies.push(predictionDiscrepancy);

    // 3. Outcome text discrepancy
    const outcomeDiscrepancy = this.checkOutcomeDiscrepancy(outcome);
    if (outcomeDiscrepancy) discrepancies.push(outcomeDiscrepancy);

    // 4. Duration discrepancy (if expected outcome mentions time constraints)
    const durationDiscrepancy = this.checkDurationDiscrepancy(outcome);
    if (durationDiscrepancy) discrepancies.push(durationDiscrepancy);

    return discrepancies;
  }

  private checkSuccessDiscrepancy(outcome: MissionOutcome): Discrepancy | null {
    // If predicted high success but failed
    if (outcome.predictedSuccess > 0.7 && !outcome.success) {
      return {
        id: generateId(),
        type: 'outcome',
        description: `Mission failed despite ${Math.round(outcome.predictedSuccess * 100)}% predicted success`,
        expected: `Success (predicted ${Math.round(outcome.predictedSuccess * 100)}%)`,
        actual: 'Failure',
        severity: 'critical',
        measurable: true,
        magnitude: outcome.predictedSuccess,
      };
    }

    // If predicted low success but succeeded (positive surprise)
    if (outcome.predictedSuccess < 0.3 && outcome.success) {
      return {
        id: generateId(),
        type: 'outcome',
        description: `Mission succeeded despite only ${Math.round(outcome.predictedSuccess * 100)}% predicted success`,
        expected: `Failure (predicted ${Math.round(outcome.predictedSuccess * 100)}%)`,
        actual: 'Success',
        severity: 'minor',
        measurable: true,
        magnitude: 1 - outcome.predictedSuccess,
      };
    }

    return null;
  }

  private checkPredictionDiscrepancy(outcome: MissionOutcome): Discrepancy | null {
    const actualBinary = outcome.success ? 1 : 0;
    const error = Math.abs(outcome.predictedSuccess - actualBinary);

    if (error > 0.5) {
      return {
        id: generateId(),
        type: 'performance',
        description: `Prediction was off by ${Math.round(error * 100)}%`,
        expected: `Predicted success: ${Math.round(outcome.predictedSuccess * 100)}%`,
        actual: `Actual: ${outcome.success ? 'Success' : 'Failure'}`,
        severity: this.classifyPredictionError(error),
        measurable: true,
        magnitude: error,
      };
    }

    return null;
  }

  private checkOutcomeDiscrepancy(outcome: MissionOutcome): Discrepancy | null {
    if (!outcome.expectedOutcome || !outcome.actualOutcome) return null;

    const expectedLower = outcome.expectedOutcome.toLowerCase();
    const actualLower = outcome.actualOutcome.toLowerCase();

    // Simple text similarity check
    const similarity = this.textSimilarity(expectedLower, actualLower);

    if (similarity < 0.3) {
      return {
        id: generateId(),
        type: 'outcome',
        description: 'Actual outcome differs significantly from expected',
        expected: outcome.expectedOutcome,
        actual: outcome.actualOutcome,
        severity: similarity < 0.1 ? 'major' : 'moderate',
        measurable: true,
        magnitude: 1 - similarity,
      };
    }

    return null;
  }

  private checkDurationDiscrepancy(outcome: MissionOutcome): Discrepancy | null {
    // If outcome mentions time constraints and duration is unreasonable
    const expectedLower = outcome.expectedOutcome.toLowerCase();
    const hasTimeConstraint =
      expectedLower.includes('fast') ||
      expectedLower.includes('quick') ||
      expectedLower.includes('under') ||
      expectedLower.includes('seconds') ||
      expectedLower.includes('minutes');

    if (hasTimeConstraint && outcome.duration > 60000) {
      return {
        id: generateId(),
        type: 'performance',
        description: `Duration ${outcome.duration}ms may exceed time constraint`,
        expected: 'Fast execution',
        actual: `${outcome.duration}ms`,
        severity: 'moderate',
        measurable: true,
        magnitude: Math.min(1, outcome.duration / 300000),
      };
    }

    return null;
  }

  private classifyPredictionError(error: number): DiscrepancySeverity {
    if (error > 0.8) return 'critical';
    if (error > 0.6) return 'major';
    if (error > 0.4) return 'moderate';
    return 'minor';
  }

  private textSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createOutcomeAnalyzer(): OutcomeAnalyzer {
  return new OutcomeAnalyzer();
}
