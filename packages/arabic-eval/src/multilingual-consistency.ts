import type { MultilingualResult } from './types.js';

export class MultilingualConsistencyTester {
  compareResults(arabicResult: string, englishResult: string, task: string): MultilingualResult {
    const similarity = this.calculateSimilarity(arabicResult, englishResult);
    const consistent = similarity > 0.5;

    return {
      consistent,
      arabicResult,
      englishResult,
      task,
      similarity,
    };
  }

  isConsistent(results: string[]): boolean {
    if (results.length < 2) return true;

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const similarity = this.calculateSimilarity(results[i], results[j]);
        if (similarity < 0.5) return false;
      }
    }

    return true;
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const aTokens = new Set(a.split(/\s+/));
    const bTokens = new Set(b.split(/\s+/));

    let intersection = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) intersection++;
    }

    const union = new Set([...aTokens, ...bTokens]).size;
    return union > 0 ? intersection / union : 0;
  }
}
