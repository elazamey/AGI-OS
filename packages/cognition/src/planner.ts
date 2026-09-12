// ============================================================================
// AGI OS - Cognitive Planner
// Generates N candidate plans using providers + deterministic fallback
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  CognitivePlan,
  CognitiveProvider,
  CognitiveInput,
  CognitiveContext,
  HypothesisSet,
  DeterministicPlanResult,
} from './types.js';
import { DeterministicPlanner } from './deterministic-planner.js';

// ---------------------------------------------------------------------------
// Cognitive Planner — generates candidate plans
// ---------------------------------------------------------------------------
export class CognitivePlanner {
  private providers: CognitiveProvider[];
  private deterministicPlanner: DeterministicPlanner;
  private defaultPlanCount: number;

  constructor(params?: {
    providers?: CognitiveProvider[];
    defaultPlanCount?: number;
  }) {
    this.providers = params?.providers ?? [];
    this.deterministicPlanner = new DeterministicPlanner();
    this.defaultPlanCount = params?.defaultPlanCount ?? 3;
  }

  /**
   * Add a cognitive provider
   */
  addProvider(provider: CognitiveProvider): void {
    this.providers.push(provider);
  }

  /**
   * Generate candidate plans
   */
  async generate(params: {
    context: CognitiveContext;
    hypothesisSet: HypothesisSet;
    planCount?: number;
  }): Promise<CognitivePlan[]> {
    const planCount = params.planCount ?? this.defaultPlanCount;

    // Try providers in order
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        try {
          const plans = await this.generateWithProvider(
            provider,
            params.context,
            params.hypothesisSet,
            planCount
          );
          if (plans.length > 0) return plans;
        } catch {
          continue;
        }
      }
    }

    // Deterministic fallback
    const fallback = this.generateDeterministic(
      params.context,
      params.hypothesisSet,
      planCount
    );
    return fallback.plans;
  }

  /**
   * Generate plans using a specific provider
   */
  private async generateWithProvider(
    provider: CognitiveProvider,
    context: CognitiveContext,
    hypothesisSet: HypothesisSet,
    planCount: number
  ): Promise<CognitivePlan[]> {
    const input: CognitiveInput = {
      context,
      hypothesisSet,
      planCount,
      constraints: context.constraints,
    };

    const output = await provider.generate(input);
    return output.plans ?? [];
  }

  /**
   * Generate plans deterministically
   */
  private generateDeterministic(
    context: CognitiveContext,
    hypothesisSet: HypothesisSet,
    planCount: number
  ): DeterministicPlanResult {
    return this.deterministicPlanner.generateMultiple({
      context,
      hypothesisSet,
      count: planCount,
    });
  }

  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<CognitiveProvider[]> {
    const available: CognitiveProvider[] = [];
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider);
      }
    }
    return available;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createCognitivePlanner(params?: {
  providers?: CognitiveProvider[];
  defaultPlanCount?: number;
}): CognitivePlanner {
  return new CognitivePlanner(params);
}
