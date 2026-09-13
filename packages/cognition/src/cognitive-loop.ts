// ============================================================================
// AGI OS - Cognitive Loop
// OBSERVE → RETRIEVE → INTERPRET → HYPOTHESIZE → PLAN → VALIDATE → DECIDE
// NO execution inside the cognitive layer
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  CognitiveContext,
  CognitiveDecision,
  CognitivePlan,
  RejectedPlan,
} from './types.js';
import type { WorldStateManager } from './world-state.js';
import type { ContextBuilder } from './context-builder.js';
import type { HypothesisEngine } from './hypothesis.js';
import type { CognitivePlanner } from './planner.js';
import { PlanValidator } from './plan-validator.js';
import { PlanRanker } from './plan-ranker.js';

// ---------------------------------------------------------------------------
// Cognitive Loop — the brain of AGI OS
// ---------------------------------------------------------------------------
export class CognitiveLoop {
  private worldStateManager: WorldStateManager;
  private contextBuilder: ContextBuilder;
  private hypothesisEngine: HypothesisEngine;
  private planner: CognitivePlanner;
  private validator: PlanValidator;
  private ranker: PlanRanker;

  private decisions: CognitiveDecision[] = [];

  constructor(params: {
    worldStateManager: WorldStateManager;
    contextBuilder: ContextBuilder;
    hypothesisEngine: HypothesisEngine;
    planner: CognitivePlanner;
    validator?: PlanValidator;
    ranker?: PlanRanker;
  }) {
    this.worldStateManager = params.worldStateManager;
    this.contextBuilder = params.contextBuilder;
    this.hypothesisEngine = params.hypothesisEngine;
    this.planner = params.planner;
    this.validator = params.validator ?? new PlanValidator();
    this.ranker = params.ranker ?? new PlanRanker();
  }

  /**
   * Run the full cognitive loop
   *
   * OBSERVE → RETRIEVE → INTERPRET → HYPOTHESIZE → PLAN → VALIDATE → DECIDE
   *
   * Returns a CognitiveDecision. Does NOT execute anything.
   */
  async process(params: {
    goal: string;
    goalId: string;
    missionState?: {
      missionId: string;
      state: string;
      taskCount: number;
      completedTasks: number;
    };
    planCount?: number;
  }): Promise<CognitiveDecision> {
    // ── 1. OBSERVE ──────────────────────────────────────────────────────
    this.worldStateManager.getState();

    // ── 2. RETRIEVE ─────────────────────────────────────────────────────
    const context = await this.contextBuilder.build({
      goal: params.goal,
      goalId: params.goalId,
      missionState: params.missionState,
    });

    // ── 3. INTERPRET ────────────────────────────────────────────────────
    const observation = this.interpretGoal(params.goal, context);

    // ── 4. HYPOTHESIZE ──────────────────────────────────────────────────
    const hypothesisSet = await this.hypothesisEngine.generate({
      observation,
    });

    // ── 5. PLAN ─────────────────────────────────────────────────────────
    const candidatePlans = await this.planner.generate({
      context,
      hypothesisSet,
      planCount: params.planCount ?? 3,
    });

    // ── 6. VALIDATE ─────────────────────────────────────────────────────
    const validations = this.validator.validateAll(
      candidatePlans,
      context.availableCapabilities,
      context.constraints
    );

    const validPlans: CognitivePlan[] = [];
    const rejectedPlans: RejectedPlan[] = [];

    for (const plan of candidatePlans) {
      const result = validations.get(plan.id);
      if (result?.valid) {
        validPlans.push(plan);
      } else {
        const reasons = result?.errors.map((e) => e.message).join('; ') ?? 'Validation failed';
        rejectedPlans.push({ plan, reason: reasons });
      }
    }

    // If no valid plans, create a blocked decision
    if (validPlans.length === 0) {
      const decision: CognitiveDecision = {
        id: generateId(),
        goalId: params.goalId,
        selectedPlan: this.createBlockedPlan(params.goal, params.goalId),
        rejectedPlans: candidatePlans.map((p) => ({
          plan: p,
          reason: 'All plans failed validation',
        })),
        hypothesisSet,
        context,
        reason: 'NO_VALID_PLAN',
        decidedAt: now().toISOString(),
      };
      this.decisions.push(decision);
      return decision;
    }

    // ── 7. RANK ─────────────────────────────────────────────────────────
    const ranked = this.ranker.rank(validPlans, context.availableCapabilities);

    // ── 8. DECIDE ───────────────────────────────────────────────────────
    const selected = ranked[0];

    const decision: CognitiveDecision = {
      id: generateId(),
      goalId: params.goalId,
      selectedPlan: selected.plan,
      rejectedPlans: [
        ...rejectedPlans,
        ...ranked.slice(1).map((r) => ({
          plan: r.plan,
          reason: `Ranked lower (score: ${r.score.toFixed(3)})`,
        })),
      ],
      hypothesisSet,
      context,
      reason: `Selected plan ranked #1 with score ${selected.score.toFixed(3)}`,
      decidedAt: now().toISOString(),
    };

    this.decisions.push(decision);
    return decision;
  }

  /**
   * Get all decisions made
   */
  getDecisions(): CognitiveDecision[] {
    return [...this.decisions];
  }

  /**
   * Get decision by ID
   */
  getDecision(id: string): CognitiveDecision | undefined {
    return this.decisions.find((d) => d.id === id);
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  private interpretGoal(goal: string, context: CognitiveContext): string {
    const parts: string[] = [`Goal: ${goal}`];

    if (context.previousFailures.length > 0) {
      parts.push(
        `Previous failures: ${context.previousFailures.map((f) => f.reason).join('; ')}`
      );
    }

    if (context.relevantMemories.length > 0) {
      parts.push(
        `Relevant memories: ${context.relevantMemories.length} found`
      );
    }

    if (context.constraints.length > 0) {
      parts.push(
        `Constraints: ${context.constraints.map((c) => c.description).join('; ')}`
      );
    }

    return parts.join('\n');
  }

  private createBlockedPlan(goal: string, goalId: string): CognitivePlan {
    return {
      id: generateId(),
      goalId,
      goal,
      assumptions: [],
      steps: [],
      expectedOutcome: 'BLOCKED — no valid plan available',
      predictedSuccess: 0,
      predictedRisk: 1,
      predictedCost: 0,
      requiredCapabilities: [],
      evidenceRefs: [],
      sourceMemoryRefs: [],
      hypothesisRefs: [],
      generatedAt: now().toISOString(),
      providerId: 'blocked',
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createCognitiveLoop(params: {
  worldStateManager: WorldStateManager;
  contextBuilder: ContextBuilder;
  hypothesisEngine: HypothesisEngine;
  planner: CognitivePlanner;
  validator?: PlanValidator;
  ranker?: PlanRanker;
}): CognitiveLoop {
  return new CognitiveLoop(params);
}
