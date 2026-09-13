import type { MemoryInterferenceResult } from './types.js';

export class MemoryInterferenceTester {
  evaluate(
    relevantMemories: string[],
    distractors: string[],
    retrieved: string[],
  ): MemoryInterferenceResult {
    const relevantSet = new Set(relevantMemories);
    const retrievedRelevant = retrieved.filter(r => relevantSet.has(r));
    const retrievedDistractors = retrieved.filter(r => distractors.includes(r));

    const precision = retrieved.length > 0 ? retrievedRelevant.length / retrieved.length : 0;
    const recall = relevantMemories.length > 0 ? retrievedRelevant.length / relevantMemories.length : 0;
    const interferenceDetected = retrievedDistractors.length > 0;

    return { relevantMemories, distractors, retrievalPrecision: precision, retrievalRecall: recall, interferenceDetected };
  }

  measureInterferenceEffect(
    withoutDistractors: string[],
    withDistractors: string[],
    relevantCount: number,
  ): { precisionDrop: number; recallDrop: number } {
    const precWithout = withoutDistractors.length > 0 ? relevantCount / withoutDistractors.length : 1;
    const precWith = withDistractors.length > 0 ? relevantCount / withDistractors.length : 1;
    const recallWithout = relevantCount > 0 ? withoutDistractors.filter(r => r.length > 0).length / relevantCount : 1;
    const recallWith = relevantCount > 0 ? withDistractors.filter(r => r.length > 0).length / relevantCount : 1;

    return {
      precisionDrop: precWithout - precWith,
      recallDrop: recallWithout - recallWith,
    };
  }
}
