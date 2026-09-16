// ============================================================================
// AGI OS - Failure Analyzer
// Categorizes failures and identifies contributing factors
// ============================================================================

import { generateId } from '@agi-os/kernel';
import type {
  Discrepancy,
  FailureAnalysis,
  FailureCategory,
  MissionOutcome,
} from './types.js';

// ---------------------------------------------------------------------------
// Failure Analyzer — categorizes failures from discrepancies
// ---------------------------------------------------------------------------
export class FailureAnalyzer {
  /**
   * Analyze discrepancies to produce failure analyses
   */
  analyze(params: {
    outcome: MissionOutcome;
    discrepancies: Discrepancy[];
  }): FailureAnalysis[] {
    const { outcome, discrepancies } = params;

    // If mission succeeded, no failure analysis needed
    if (outcome.success && discrepancies.every((d) => d.severity !== 'critical')) {
      return [];
    }

    const analyses: FailureAnalysis[] = [];

    for (const discrepancy of discrepancies) {
      const category = this.categorizeFailure(discrepancy, outcome);
      const factors = this.identifyContributingFactors(discrepancy, outcome);

      analyses.push({
        id: generateId(),
        discrepancyId: discrepancy.id,
        category,
        description: this.generateDescription(discrepancy, category),
        contributingFactors: factors,
        evidenceRefs: outcome.evidenceRefs,
        confidence: this.calculateConfidence(discrepancy, category),
      });
    }

    return analyses;
  }

  /**
   * Categorize a failure based on discrepancy and context
   */
  private categorizeFailure(
    discrepancy: Discrepancy,
    outcome: MissionOutcome
  ): FailureCategory {
    const desc = discrepancy.description.toLowerCase();
    discrepancy.expected.toLowerCase();
    discrepancy.actual.toLowerCase();

    // Check for specific patterns
    if (desc.includes('missing') || desc.includes('not found') || desc.includes('unavailable')) {
      return 'resource_unavailable';
    }

    if (desc.includes('constraint') || desc.includes('violat') || desc.includes('denied')) {
      return 'constraint_violation';
    }

    if (desc.includes('tool') || desc.includes('executor') || desc.includes('crash')) {
      return 'tool_failure';
    }

    if (desc.includes('timeout') || desc.includes('hang') || desc.includes('slow')) {
      return 'execution_error';
    }

    if (desc.includes('predict') && discrepancy.type === 'performance') {
      return 'incorrect_assumption';
    }

    if (desc.includes('plan') || desc.includes('strategy') || desc.includes('approach')) {
      return 'planning_error';
    }

    if (desc.includes('depend') || desc.includes('external') || desc.includes('api')) {
      return 'external_dependency';
    }

    if (desc.includes('information') || desc.includes('data') || desc.includes('context')) {
      return 'missing_information';
    }

    // Default based on outcome success
    if (!outcome.success) {
      return 'execution_error';
    }

    return 'unknown';
  }

  /**
   * Identify contributing factors
   */
  private identifyContributingFactors(
    discrepancy: Discrepancy,
    outcome: MissionOutcome
  ): string[] {
    const factors: string[] = [];

    // Prediction was too optimistic
    if (outcome.predictedSuccess > 0.7 && !outcome.success) {
      factors.push('Overly optimistic prediction');
    }

    // Prediction was too pessimistic
    if (outcome.predictedSuccess < 0.3 && outcome.success) {
      factors.push('Overly pessimistic prediction');
    }

    // High risk was underestimated
    if (outcome.predictedRisk < 0.3 && !outcome.success) {
      factors.push('Risk was underestimated');
    }

    // Large magnitude discrepancy
    if (discrepancy.magnitude > 0.7) {
      factors.push('Large magnitude discrepancy');
    }

    // Outcome text differs significantly
    if (discrepancy.type === 'outcome' && discrepancy.magnitude > 0.5) {
      factors.push('Actual outcome diverged from expected');
    }

    // Duration-based
    if (discrepancy.type === 'performance' && discrepancy.actual.includes('ms')) {
      factors.push('Performance exceeded threshold');
    }

    return factors;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    discrepancy: Discrepancy,
    category: FailureCategory
  ): string {
    const categoryLabels: Record<FailureCategory, string> = {
      missing_information: 'Missing information',
      incorrect_assumption: 'Incorrect assumption',
      resource_unavailable: 'Resource unavailable',
      constraint_violation: 'Constraint violation',
      tool_failure: 'Tool failure',
      planning_error: 'Planning error',
      execution_error: 'Execution error',
      external_dependency: 'External dependency issue',
      unknown: 'Unknown failure',
    };

    return `${categoryLabels[category]}: ${discrepancy.description}`;
  }

  /**
   * Calculate confidence in the analysis
   */
  private calculateConfidence(
    discrepancy: Discrepancy,
    category: FailureCategory
  ): number {
    let confidence = 0.5; // base

    // Higher confidence for measurable discrepancies
    if (discrepancy.measurable) confidence += 0.2;

    // Higher confidence for severe discrepancies
    if (discrepancy.severity === 'critical') confidence += 0.2;
    else if (discrepancy.severity === 'major') confidence += 0.1;

    // Lower confidence for unknown category
    if (category === 'unknown') confidence -= 0.2;

    // Higher confidence for specific categories
    if (['tool_failure', 'constraint_violation', 'resource_unavailable'].includes(category)) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Group analyses by category
   */
  groupByCategory(analyses: FailureAnalysis[]): Map<FailureCategory, FailureAnalysis[]> {
    const grouped = new Map<FailureCategory, FailureAnalysis[]>();

    for (const a of analyses) {
      const existing = grouped.get(a.category) ?? [];
      existing.push(a);
      grouped.set(a.category, existing);
    }

    return grouped;
  }

  /**
   * Get most common failure category
   */
  getMostCommonCategory(analyses: FailureAnalysis[]): FailureCategory | null {
    if (analyses.length === 0) return null;

    const counts = new Map<FailureCategory, number>();
    for (const a of analyses) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }

    let maxCount = 0;
    let maxCategory: FailureCategory | null = null;

    for (const [category, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category;
      }
    }

    return maxCategory;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createFailureAnalyzer(): FailureAnalyzer {
  return new FailureAnalyzer();
}
