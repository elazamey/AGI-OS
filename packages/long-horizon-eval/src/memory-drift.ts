import type { MemoryDriftResult } from './types.js';

export class MemoryDriftTester {
  private facts: Map<string, { history: { value: string; step: number }[] }> = new Map();

  setFact(factId: string, value: string, step: number): void {
    const existing = this.facts.get(factId);
    if (existing) {
      existing.history.push({ value, step });
    } else {
      this.facts.set(factId, { history: [{ value, step }] });
    }
  }

  retrieve(factId: string, retrievalStep: number): MemoryDriftResult | null {
    const fact = this.facts.get(factId);
    if (!fact || fact.history.length === 0) return null;

    const original = fact.history[0];
    const current = fact.history[fact.history.length - 1];
    const retrieved = fact.history.filter(h => h.step <= retrievalStep).pop() ?? original;

    return {
      factId,
      originalValue: original.value,
      updatedValue: current.value,
      updateStep: current.step,
      retrievedValue: retrieved.value,
      retrievalStep,
      currentCorrect: retrieved.value === current.value,
      driftDetected: retrieved.value !== current.value,
    };
  }

  getAllFacts(): string[] {
    return Array.from(this.facts.keys());
  }

  clear(): void {
    this.facts.clear();
  }
}
