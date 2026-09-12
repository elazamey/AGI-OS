import { generateId } from '@agi-os/kernel';
import type {
  FailureAnalysis,
  RootCause,
  RootCauseConfidence,
  MissionOutcome,
} from './types.js';

export class RootCauseExtractor {
  extract(params: {
    outcome: MissionOutcome;
    failureAnalyses: FailureAnalysis[];
  }): RootCause[] {
    const { outcome, failureAnalyses } = params;
    const rootCauses: RootCause[] = [];

    for (const analysis of failureAnalyses) {
      const cause = this.inferRootCause(analysis, outcome);
      if (cause) rootCauses.push(cause);
    }

    const systemic = this.detectSystemicRootCause(failureAnalyses, outcome);
    if (systemic) rootCauses.push(systemic);

    return rootCauses;
  }

  private inferRootCause(
    analysis: FailureAnalysis,
    outcome: MissionOutcome
  ): RootCause | null {
    const causes: Array<{ cause: string; mechanism: string; confidence: RootCauseConfidence }> = [];

    switch (analysis.category) {
      case 'incorrect_assumption':
        causes.push({
          cause: 'Planner assumed conditions that were not true',
          mechanism: `Predicted ${Math.round(outcome.predictedSuccess * 100)}% success but mission failed`,
          confidence: 'high',
        });
        break;
      case 'missing_information':
        causes.push({
          cause: 'Insufficient world state information at planning time',
          mechanism: 'Missing data led to incorrect decision',
          confidence: 'medium',
        });
        break;
      case 'resource_unavailable':
        causes.push({
          cause: 'Required resource was not available during execution',
          mechanism: 'Resource dependency not checked before execution',
          confidence: 'high',
        });
        break;
      case 'constraint_violation':
        causes.push({
          cause: 'Plan violated a system or environmental constraint',
          mechanism: 'Constraint was not included in plan validation',
          confidence: 'high',
        });
        break;
      case 'tool_failure':
        causes.push({
          cause: 'Tool or capability failed during execution',
          mechanism: 'Tool reliability was overestimated',
          confidence: 'medium',
        });
        break;
      case 'planning_error':
        causes.push({
          cause: 'Plan contained flawed logic or incorrect sequencing',
          mechanism: 'Planner did not account for all dependencies',
          confidence: 'medium',
        });
        break;
      case 'execution_error':
        causes.push({
          cause: 'Execution deviated from the plan',
          mechanism: 'Unexpected runtime condition caused deviation',
          confidence: 'low',
        });
        break;
      case 'external_dependency':
        causes.push({
          cause: 'External system or dependency was unavailable',
          mechanism: 'External dependency not resilient to failure',
          confidence: 'medium',
        });
        break;
      default:
        return null;
    }

    const best = causes.sort(
      (a, b) => this.confidenceScore(b.confidence) - this.confidenceScore(a.confidence)
    )[0];

    if (!best) return null;

    return {
      id: generateId(),
      failureAnalysisId: analysis.id,
      cause: best.cause,
      mechanism: best.mechanism,
      evidenceRefs: analysis.evidenceRefs,
      confidence: best.confidence,
      reproducible: this.assessReproducibility(analysis),
    };
  }

  private detectSystemicRootCause(
    analyses: FailureAnalysis[],
    outcome: MissionOutcome
  ): RootCause | null {
    if (analyses.length < 2) return null;

    const categoryCounts = new Map<string, number>();
    for (const a of analyses) {
      categoryCounts.set(a.category, (categoryCounts.get(a.category) ?? 0) + 1);
    }

    for (const [category, count] of categoryCounts) {
      if (count >= 2) {
        return {
          id: generateId(),
          failureAnalysisId: 'systemic',
          cause: `Systemic pattern: ${count} failures of category "${category}"`,
          mechanism: `Repeated ${category} failures indicate a structural issue`,
          evidenceRefs: analyses.flatMap((a) => a.evidenceRefs),
          confidence: count >= 3 ? 'high' : 'medium',
          reproducible: true,
        };
      }
    }

    return null;
  }

  private assessReproducibility(analysis: FailureAnalysis): boolean {
    return analysis.confidence > 0.6 && analysis.contributingFactors.length >= 2;
  }

  private confidenceScore(c: RootCauseConfidence): number {
    switch (c) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
    }
  }

  sortByConfidence(causes: RootCause[]): RootCause[] {
    return [...causes].sort(
      (a, b) => this.confidenceScore(b.confidence) - this.confidenceScore(a.confidence)
    );
  }

  getReproducible(causes: RootCause[]): RootCause[] {
    return causes.filter((c) => c.reproducible);
  }
}

export function createRootCauseExtractor(): RootCauseExtractor {
  return new RootCauseExtractor();
}