// ============================================================================
// AGI OS - Deterministic Planner
// Generates plans without LLM — rule-based fallback
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  CognitivePlan,
  Assumption,
  PlanStep,
  CognitiveContext,
  HypothesisSet,
  DeterministicPlanResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Deterministic Planner — generates plans from rules
// ---------------------------------------------------------------------------
export class DeterministicPlanner {
  /**
   * Generate a conservative plan from context
   */
  generateConservative(params: {
    context: CognitiveContext;
    hypothesisSet: HypothesisSet;
  }): DeterministicPlanResult {
    const { context, hypothesisSet } = params;

    const steps: PlanStep[] = [];
    let order = 1;

    // Step 1: Gather information
    steps.push({
      id: generateId(),
      order: order++,
      action: 'Gather current world state and observations',
      expectedOutcome: 'Updated world state with latest observations',
      dependsOn: [],
      estimatedDuration: 1000,
      riskLevel: 'none',
    });

    // Step 2: Retrieve relevant memories
    steps.push({
      id: generateId(),
      order: order++,
      action: 'Retrieve relevant memories for goal',
      expectedOutcome: 'Context enriched with historical knowledge',
      dependsOn: [steps[0].id],
      estimatedDuration: 500,
      riskLevel: 'none',
    });

    // Step 3: Analyze hypotheses
    if (hypothesisSet.hypotheses.length > 0) {
      steps.push({
        id: generateId(),
        order: order++,
        action: `Evaluate ${hypothesisSet.hypotheses.length} hypotheses`,
        expectedOutcome: 'Ranked hypotheses with confidence scores',
        dependsOn: [steps[1].id],
        estimatedDuration: 2000,
        riskLevel: 'low',
      });
    }

    // Step 4: Execute safest action based on hypothesis
    const safestHypothesis = hypothesisSet.hypotheses.sort(
      (a, b) => b.confidence - a.confidence
    )[0];

    if (safestHypothesis) {
      for (const test of safestHypothesis.suggestedTests.slice(0, 2)) {
        steps.push({
          id: generateId(),
          order: order++,
          action: test,
          expectedOutcome: 'Observation from test execution',
          dependsOn: [steps[steps.length - 1].id],
          estimatedDuration: 3000,
          riskLevel: 'low',
        });
      }
    }

    // Step 5: Verify outcome
    steps.push({
      id: generateId(),
      order: order++,
      action: 'Verify outcome matches expected result',
      expectedOutcome: 'Confirmation of success or failure',
      dependsOn: [steps[steps.length - 1].id],
      estimatedDuration: 1000,
      riskLevel: 'none',
    });

    const assumptions: Assumption[] = [
      {
        id: generateId(),
        statement: 'World state is accurate at time of planning',
        confidence: 0.8,
        impactIfWrong: 'medium',
      },
      {
        id: generateId(),
        statement: 'Available capabilities remain accessible during execution',
        confidence: 0.9,
        impactIfWrong: 'high',
      },
    ];

    const plan: CognitivePlan = {
      id: generateId(),
      goalId: context.goalId,
      goal: context.goal,
      assumptions,
      steps,
      expectedOutcome: `Goal "${context.goal}" achieved through conservative approach`,
      predictedSuccess: 0.6,
      predictedRisk: 0.15,
      predictedCost: 0.3,
      requiredCapabilities: context.availableCapabilities.slice(0, 3),
      evidenceRefs: [],
      sourceMemoryRefs: context.relevantMemories.map((m) => m.id),
      hypothesisRefs: hypothesisSet.hypotheses.map((h) => h.id),
      generatedAt: now().toISOString(),
      providerId: 'deterministic',
    };

    return {
      plans: [plan],
      source: 'deterministic',
      reason: 'No LLM provider available — using rule-based planning',
    };
  }

  /**
   * Generate multiple deterministic plans (varied risk profiles)
   */
  generateMultiple(params: {
    context: CognitiveContext;
    hypothesisSet: HypothesisSet;
    count?: number;
  }): DeterministicPlanResult {
    const count = params.count ?? 3;
    const plans: CognitivePlan[] = [];

    // Conservative plan
    const conservative = this.generateConservative(params);
    plans.push(...conservative.plans);

    // Moderate plan (if count > 1)
    if (count > 1) {
      const moderate = this.createPlanWithRiskProfile(
        params,
        'moderate',
        0.7,
        0.35,
        0.25
      );
      plans.push(moderate);
    }

    // Aggressive plan (if count > 2)
    if (count > 2) {
      const aggressive = this.createPlanWithRiskProfile(
        params,
        'aggressive',
        0.85,
        0.6,
        0.15
      );
      plans.push(aggressive);
    }

    return {
      plans: plans.slice(0, count),
      source: 'deterministic',
      reason: 'No LLM provider available — using rule-based multi-profile planning',
    };
  }

  private createPlanWithRiskProfile(
    params: { context: CognitiveContext; hypothesisSet: HypothesisSet },
    profile: string,
    success: number,
    risk: number,
    cost: number
  ): CognitivePlan {
    const { context, hypothesisSet } = params;

    const steps: PlanStep[] = [
      {
        id: generateId(),
        order: 1,
        action: `Analyze goal: ${context.goal}`,
        expectedOutcome: 'Goal decomposition complete',
        dependsOn: [],
        estimatedDuration: 1000,
        riskLevel: 'none',
      },
      {
        id: generateId(),
        order: 2,
        action: 'Execute primary approach',
        expectedOutcome: 'Goal state achieved',
        dependsOn: [],
        estimatedDuration: 5000,
        riskLevel: risk > 0.5 ? 'high' : 'medium',
      },
      {
        id: generateId(),
        order: 3,
        action: 'Verify and validate result',
        expectedOutcome: 'Confirmation of success',
        dependsOn: [],
        estimatedDuration: 1000,
        riskLevel: 'none',
      },
    ];

    // Make steps sequential
    steps[1].dependsOn = [steps[0].id];
    steps[2].dependsOn = [steps[1].id];

    return {
      id: generateId(),
      goalId: context.goalId,
      goal: context.goal,
      assumptions: [
        {
          id: generateId(),
          statement: `${profile} approach is appropriate for this goal`,
          confidence: 1 - risk,
          impactIfWrong: risk > 0.5 ? 'high' : 'medium',
        },
      ],
      steps,
      expectedOutcome: `Goal achieved via ${profile} approach`,
      predictedSuccess: success,
      predictedRisk: risk,
      predictedCost: cost,
      requiredCapabilities: context.availableCapabilities.slice(0, 2),
      evidenceRefs: [],
      sourceMemoryRefs: context.relevantMemories.slice(0, 3).map((m) => m.id),
      hypothesisRefs: hypothesisSet.hypotheses.slice(0, 2).map((h) => h.id),
      generatedAt: now().toISOString(),
      providerId: 'deterministic',
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createDeterministicPlanner(): DeterministicPlanner {
  return new DeterministicPlanner();
}
