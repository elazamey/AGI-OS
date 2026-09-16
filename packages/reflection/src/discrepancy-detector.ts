// ============================================================================
// AGI OS - Discrepancy Detector
// Classifies and ranks discrepancies by severity and type
// ============================================================================

import { generateId } from '@agi-os/kernel';
import type {
  Discrepancy,
  DiscrepancyType,
  DiscrepancySeverity,
  FailureGroup,
  CascadingFailureConfig,
  FailureCategory,
  CandidateLesson,
  MissionOutcome,
} from './types.js';

// ---------------------------------------------------------------------------
// Discrepancy Detector — classifies and ranks discrepancies
// ---------------------------------------------------------------------------
export class DiscrepancyDetector {
  private severityWeights: Record<DiscrepancySeverity, number> = {
    negligible: 0.1,
    minor: 0.3,
    moderate: 0.5,
    major: 0.8,
    critical: 1.0,
  };

  /**
   * Classify discrepancies by type
   */
  classifyByType(discrepancies: Discrepancy[]): Map<DiscrepancyType, Discrepancy[]> {
    const classified = new Map<DiscrepancyType, Discrepancy[]>();

    for (const d of discrepancies) {
      const existing = classified.get(d.type) ?? [];
      existing.push(d);
      classified.set(d.type, existing);
    }

    return classified;
  }

  /**
   * Sort discrepancies by severity (most severe first)
   */
  sortBySeverity(discrepancies: Discrepancy[]): Discrepancy[] {
    return [...discrepancies].sort(
      (a, b) => this.severityWeights[b.severity] - this.severityWeights[a.severity]
    );
  }

  /**
   * Get discrepancies above a threshold
   */
  filterByMinSeverity(
    discrepancies: Discrepancy[],
    minSeverity: DiscrepancySeverity
  ): Discrepancy[] {
    const threshold = this.severityWeights[minSeverity];
    return discrepancies.filter((d) => this.severityWeights[d.severity] >= threshold);
  }

  /**
   * Calculate overall discrepancy score (0-1, higher = more discrepancies)
   */
  calculateOverallScore(discrepancies: Discrepancy[]): number {
    if (discrepancies.length === 0) return 0;

    const totalWeight = discrepancies.reduce(
      (sum, d) => sum + this.severityWeights[d.severity] * d.magnitude,
      0
    );

    return Math.min(1, totalWeight / discrepancies.length);
  }

  /**
   * Check if discrepancies indicate a systematic pattern
   */
  detectPattern(discrepancies: Discrepancy[]): {
    hasPattern: boolean;
    patternType: string;
    confidence: number;
  } | null {
    if (discrepancies.length < 2) return null;

    // Check for same-type pattern
    const typeCounts = new Map<DiscrepancyType, number>();
    for (const d of discrepancies) {
      typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);
    }

    for (const [type, count] of typeCounts) {
      if (count >= 2 && count / discrepancies.length >= 0.5) {
        return {
          hasPattern: true,
          patternType: type,
          confidence: count / discrepancies.length,
        };
      }
    }

    // Check for same-severity pattern
    const severityCounts = new Map<DiscrepancySeverity, number>();
    for (const d of discrepancies) {
      severityCounts.set(d.severity, (severityCounts.get(d.severity) ?? 0) + 1);
    }

    for (const [severity, count] of severityCounts) {
      if (count >= 2 && count / discrepancies.length >= 0.5) {
        return {
          hasPattern: true,
          patternType: `repeated_${severity}`,
          confidence: count / discrepancies.length,
        };
      }
    }

    return null;
  }

  /**
   * Summarize discrepancies into a compact report
   */
  summarize(discrepancies: Discrepancy[]): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    overallScore: number;
    criticalCount: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let criticalCount = 0;

    for (const d of discrepancies) {
      byType[d.type] = (byType[d.type] ?? 0) + 1;
      bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
      if (d.severity === 'critical') criticalCount++;
    }

    return {
      total: discrepancies.length,
      byType,
      bySeverity,
      overallScore: this.calculateOverallScore(discrepancies),
      criticalCount,
    };
  }

  // -----------------------------------------------------------------------
  // Cascading Failure Grouping (Phase 5 Enhancement)
  // -----------------------------------------------------------------------

  /**
   * Group cascading failures by time window and root cause
   * Prevents redundant lessons from flooding memory
   */
  groupCascadingFailures(params: {
    outcomes: MissionOutcome[];
    rootCauseExtractor: (outcome: MissionOutcome) => string;
    categoryExtractor: (outcome: MissionOutcome) => FailureCategory;
    config?: Partial<CascadingFailureConfig>;
  }): FailureGroup[] {
    const { outcomes, rootCauseExtractor, categoryExtractor, config: userConfig } = params;
    const cfg = { ...DEFAULT_CASCADING_CONFIG, ...userConfig };

    // Sort by timestamp
    const sorted = [...outcomes].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: FailureGroup[] = [];
    let currentGroup: MissionOutcome[] = [];
    let currentCause = '';

    for (const outcome of sorted) {
      if (outcome.success) continue; // skip successes

      const cause = rootCauseExtractor(outcome);
      const causeChanged = cause !== currentCause;
      const timeGap = currentGroup.length > 0
        ? new Date(outcome.timestamp).getTime() - new Date(currentGroup[currentGroup.length - 1].timestamp).getTime()
        : 0;

      // Start new group if cause changed or time window exceeded
      if (causeChanged || timeGap > cfg.timeWindowMs) {
        if (currentGroup.length >= cfg.minGroupSize) {
          groups.push(this.buildFailureGroup(currentGroup, currentCause, categoryExtractor));
        }
        currentGroup = [outcome];
        currentCause = cause;
      } else {
        currentGroup.push(outcome);
      }
    }

    // Finalize last group
    if (currentGroup.length >= cfg.minGroupSize) {
      groups.push(this.buildFailureGroup(currentGroup, currentCause, categoryExtractor));
    }

    return groups;
  }

  /**
   * Build a consolidated FailureGroup from multiple outcomes
   */
  private buildFailureGroup(
    outcomes: MissionOutcome[],
    rootCause: string,
    categoryExtractor: (o: MissionOutcome) => FailureCategory
  ): FailureGroup {
    const timestamps = outcomes.map((o) => new Date(o.timestamp).getTime());
    const missionIds = outcomes.map((o) => o.missionId);

    // Most severe category across the group
    const categoryCounts = new Map<FailureCategory, number>();
    for (const o of outcomes) {
      const cat = categoryExtractor(o);
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
    let dominantCategory: FailureCategory = 'unknown';
    let maxCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > maxCount) { maxCount = count; dominantCategory = cat; }
    }

    // Generate consolidated lesson
    const consolidatedLesson: CandidateLesson = {
      id: generateId(),
      rootCauseId: 'cascading',
      statement: `Cascading failure: ${rootCause} caused ${outcomes.length} consecutive mission failures`,
      category: this.mapCategoryToLessonCategory(dominantCategory),
      impact: outcomes.length >= 5 ? 'critical' : outcomes.length >= 3 ? 'high' : 'medium',
      applicability: ['resilience', 'failure_prevention'],
      prerequisites: ['failure_monitoring'],
      suggestedAction: `Address root cause: ${rootCause}. Add circuit breaker or fallback.`,
      confidence: Math.min(1, 0.6 + outcomes.length * 0.05),
    };

    return {
      id: generateId(),
      rootCause,
      failureCategory: dominantCategory,
      missionIds,
      timestampRange: {
        first: new Date(Math.min(...timestamps)).toISOString(),
        last: new Date(Math.max(...timestamps)).toISOString(),
      },
      count: outcomes.length,
      consolidatedLesson,
      severity: this.classifyGroupSeverity(outcomes.length),
    };
  }

  private mapCategoryToLessonCategory(cat: FailureCategory): 'strategic' | 'tactical' | 'procedural' | 'environmental' | 'resource' | 'constraint_awareness' {
    switch (cat) {
      case 'tool_failure': return 'procedural';
      case 'resource_unavailable': return 'resource';
      case 'constraint_violation': return 'constraint_awareness';
      case 'external_dependency': return 'environmental';
      case 'planning_error': return 'tactical';
      case 'incorrect_assumption': return 'strategic';
      default: return 'procedural';
    }
  }

  private classifyGroupSeverity(count: number): DiscrepancySeverity {
    if (count >= 5) return 'critical';
    if (count >= 3) return 'major';
    if (count >= 2) return 'moderate';
    return 'minor';
  }
}

const DEFAULT_CASCADING_CONFIG: CascadingFailureConfig = {
  timeWindowMs: 5 * 60 * 1000, // 5 minutes
  minGroupSize: 2,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createDiscrepancyDetector(): DiscrepancyDetector {
  return new DiscrepancyDetector();
}
