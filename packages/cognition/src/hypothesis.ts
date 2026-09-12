// ============================================================================
// AGI OS - Hypothesis Engine
// Generates hypotheses from observations before jumping to solutions
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { CognitiveProvider, Hypothesis, HypothesisSet } from './types.js';

// ---------------------------------------------------------------------------
// Hypothesis Engine — generates testable hypotheses from observations
// ---------------------------------------------------------------------------
export class HypothesisEngine {
  private providers: CognitiveProvider[];

  constructor(providers: CognitiveProvider[] = []) {
    this.providers = providers;
  }

  /**
   * Add a cognitive provider
   */
  addProvider(provider: CognitiveProvider): void {
    this.providers.push(provider);
  }

  /**
   * Generate hypotheses from an observation
   */
  async generate(params: {
    observation: string;
    context?: Record<string, unknown>;
    maxHypotheses?: number;
  }): Promise<HypothesisSet> {
    const maxH = params.maxHypotheses ?? 5;

    // Try providers in order
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        try {
          return await this.generateWithProvider(provider, params.observation, maxH);
        } catch {
          continue;
        }
      }
    }

    // Deterministic fallback
    return this.generateDeterministic(params.observation, maxH);
  }

  /**
   * Generate hypotheses using a provider
   */
  private async generateWithProvider(
    provider: CognitiveProvider,
    observation: string,
    maxH: number
  ): Promise<HypothesisSet> {
    const input = {
      context: {} as any,
      hypothesisSet: { id: '', observation, hypotheses: [], generatedAt: '', providerId: '' },
      planCount: 0,
      constraints: [],
    };

    const output = await provider.generate(input);

    const hypotheses: Hypothesis[] = (output.plans ?? []).slice(0, maxH).map((p) => ({
      id: generateId(),
      observation,
      statement: p.goal,
      confidence: p.predictedSuccess,
      testable: true,
      evidenceRefs: p.evidenceRefs ?? [],
      suggestedTests: p.steps?.map((s) => s.action) ?? [],
      category: 'causal' as const,
    }));

    return {
      id: generateId(),
      observation,
      hypotheses,
      generatedAt: now().toISOString(),
      providerId: provider.id,
    };
  }

  /**
   * Deterministic hypothesis generation — rule-based
   */
  generateDeterministic(
    observation: string,
    maxH: number
  ): HypothesisSet {
    const lower = observation.toLowerCase();
    const hypotheses: Hypothesis[] = [];

    // Pattern-based hypothesis generation
    if (lower.includes('fail') || lower.includes('error')) {
      hypotheses.push({
        id: generateId(),
        observation,
        statement: 'A dependency or configuration mismatch may be causing the failure',
        confidence: 0.6,
        testable: true,
        evidenceRefs: [],
        suggestedTests: ['Check dependencies', 'Verify configuration'],
        category: 'structural',
      });
    }

    if (lower.includes('slow') || lower.includes('performance')) {
      hypotheses.push({
        id: generateId(),
        observation,
        statement: 'Resource contention or inefficient algorithm may be the cause',
        confidence: 0.55,
        testable: true,
        evidenceRefs: [],
        suggestedTests: ['Profile execution', 'Check resource usage'],
        category: 'causal',
      });
    }

    if (lower.includes('timeout') || lower.includes('hang')) {
      hypotheses.push({
        id: generateId(),
        observation,
        statement: 'A blocking operation or infinite loop may be occurring',
        confidence: 0.65,
        testable: true,
        evidenceRefs: [],
        suggestedTests: ['Add timeouts', 'Check for deadlocks'],
        category: 'causal',
      });
    }

    if (lower.includes('missing') || lower.includes('not found')) {
      hypotheses.push({
        id: generateId(),
        observation,
        statement: 'The expected resource or entity may not have been created or may have been removed',
        confidence: 0.7,
        testable: true,
        evidenceRefs: [],
        suggestedTests: ['Verify existence', 'Check creation path'],
        category: 'structural',
      });
    }

    // Always add a generic hypothesis
    hypotheses.push({
      id: generateId(),
      observation,
      statement: 'The root cause may require deeper investigation of system state and logs',
      confidence: 0.4,
      testable: true,
      evidenceRefs: [],
      suggestedTests: ['Review logs', 'Inspect world state'],
      category: 'procedural',
    });

    return {
      id: generateId(),
      observation,
      hypotheses: hypotheses.slice(0, maxH),
      generatedAt: now().toISOString(),
      providerId: 'deterministic',
    };
  }

  /**
   * Rank hypotheses by confidence
   */
  rankHypotheses(set: HypothesisSet): Hypothesis[] {
    return [...set.hypotheses].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Filter testable hypotheses
   */
  getTestable(set: HypothesisSet): Hypothesis[] {
    return set.hypotheses.filter((h) => h.testable);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createHypothesisEngine(
  providers?: CognitiveProvider[]
): HypothesisEngine {
  return new HypothesisEngine(providers);
}
