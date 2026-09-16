import { generateId, now } from '@agi-os/kernel';
import type { BenchmarkResult, RegressionReport, Regression } from './types.js';

export class RegressionTracker {
  private history: Map<string, BenchmarkResult[]> = new Map();

  recordResults(model: string, results: BenchmarkResult[]): void {
    const key = model;
    const existing = this.history.get(key) ?? [];
    existing.push(...results);
    this.history.set(key, existing);
  }

  getResults(model: string): BenchmarkResult[] {
    return this.history.get(model) ?? [];
  }

  getLatestResults(model: string, count: number = 10): BenchmarkResult[] {
    const results = this.history.get(model) ?? [];
    return results.slice(-count);
  }

  generateReport(model: string): RegressionReport {
    const results = this.history.get(model) ?? [];
    const scenarioScores = new Map<string, number[]>();

    for (const r of results) {
      const scores = scenarioScores.get(r.scenarioId) ?? [];
      scores.push(r.score);
      scenarioScores.set(r.scenarioId, scores);
    }

    const regressions: Regression[] = [];
    const improvements: Regression[] = [];

    for (const [scenarioId, scores] of scenarioScores) {
      if (scores.length < 2) continue;
      const previous = scores[scores.length - 2];
      const current = scores[scores.length - 1];
      const delta = current - previous;

      if (Math.abs(delta) < 0.01) continue;

      const regression: Regression = {
        scenarioId,
        previousScore: previous,
        currentScore: current,
        delta,
        trend: delta > 0 ? 'improving' : 'regressing',
      };

      if (delta < 0) regressions.push(regression);
      else improvements.push(regression);
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    return {
      id: generateId(),
      model,
      totalScenarios: total,
      passed,
      failed: total - passed,
      score: total > 0 ? results.reduce((s, r) => s + r.score, 0) / total : 0,
      regressions,
      improvements,
      timestamp: now().toISOString(),
    };
  }

  detectRegressions(model: string, threshold: number = -0.1): Regression[] {
    const report = this.generateReport(model);
    return report.regressions.filter(r => r.delta <= threshold);
  }

  clear(): void {
    this.history.clear();
  }
}
