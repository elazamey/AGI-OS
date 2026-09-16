// ============================================================================
// AGI OS - Plan Ranker
// Deterministic ranking of candidate plans by risk, cost, confidence
// ============================================================================

import type {
  CognitivePlan,
  RankedPlan,
  RankingBreakdown,
} from './types.js';

// ---------------------------------------------------------------------------
// Plan Ranker — scores and ranks validated plans
// ---------------------------------------------------------------------------
export class PlanRanker {
  private weights: RankingWeights;

  constructor(params?: Partial<RankingWeights>) {
    this.weights = {
      successWeight: 0.35,
      riskWeight: 0.30,
      costWeight: 0.15,
      capabilityWeight: 0.10,
      assumptionWeight: 0.10,
      ...params,
    };
  }

  /**
   * Rank plans from best to worst
   */
  rank(
    plans: CognitivePlan[],
    availableCapabilities: string[] = []
  ): RankedPlan[] {
    const scored = plans.map((plan) => ({
      plan,
      rank: 0,
      score: 0,
      breakdown: this.scorePlan(plan, availableCapabilities),
    }));

    // Calculate total score from breakdown
    for (const item of scored) {
      item.score = this.calculateTotalScore(item.breakdown);
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Assign ranks
    scored.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return scored;
  }

  /**
   * Get the best plan
   */
  getBest(
    plans: CognitivePlan[],
    availableCapabilities: string[] = []
  ): RankedPlan | null {
    const ranked = this.rank(plans, availableCapabilities);
    return ranked.length > 0 ? ranked[0] : null;
  }

  /**
   * Score a single plan
   */
  private scorePlan(
    plan: CognitivePlan,
    availableCapabilities: string[]
  ): RankingBreakdown {
    return {
      successScore: this.scoreSuccess(plan),
      riskScore: this.scoreRisk(plan),
      costScore: this.scoreCost(plan),
      capabilityScore: this.scoreCapability(plan, availableCapabilities),
      assumptionScore: this.scoreAssumptions(plan),
    };
  }

  private calculateTotalScore(breakdown: RankingBreakdown): number {
    const w = this.weights;
    return (
      breakdown.successScore * w.successWeight +
      breakdown.riskScore * w.riskWeight +
      breakdown.costScore * w.costWeight +
      breakdown.capabilityScore * w.capabilityWeight +
      breakdown.assumptionScore * w.assumptionWeight
    );
  }

  /**
   * Higher predicted success = higher score
   */
  private scoreSuccess(plan: CognitivePlan): number {
    return Math.max(0, Math.min(1, plan.predictedSuccess));
  }

  /**
   * Lower risk = higher score (inverted)
   */
  private scoreRisk(plan: CognitivePlan): number {
    return 1 - Math.max(0, Math.min(1, plan.predictedRisk));
  }

  /**
   * Lower cost = higher score (inverted, normalized)
   */
  private scoreCost(plan: CognitivePlan): number {
    // Cost is 0-1, lower is better
    return 1 - Math.max(0, Math.min(1, plan.predictedCost));
  }

  /**
   * More available capabilities = higher score
   */
  private scoreCapability(
    plan: CognitivePlan,
    availableCapabilities: string[]
  ): number {
    if (plan.requiredCapabilities.length === 0) return 1.0;

    const available = plan.requiredCapabilities.filter((cap) =>
      availableCapabilities.includes(cap)
    );

    return available.length / plan.requiredCapabilities.length;
  }

  /**
   * Fewer critical low-confidence assumptions = higher score
   */
  private scoreAssumptions(plan: CognitivePlan): number {
    if (plan.assumptions.length === 0) return 1.0;

    let penalty = 0;
    for (const assumption of plan.assumptions) {
      if (assumption.impactIfWrong === 'critical') {
        penalty += (1 - assumption.confidence) * 0.3;
      } else if (assumption.impactIfWrong === 'high') {
        penalty += (1 - assumption.confidence) * 0.15;
      } else if (assumption.impactIfWrong === 'medium') {
        penalty += (1 - assumption.confidence) * 0.05;
      }
    }

    return Math.max(0, 1 - penalty);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RankingWeights {
  successWeight: number;
  riskWeight: number;
  costWeight: number;
  capabilityWeight: number;
  assumptionWeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createPlanRanker(params?: Partial<RankingWeights>): PlanRanker {
  return new PlanRanker(params);
}
