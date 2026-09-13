import { generateId, now } from '@agi-os/kernel';
import { PolicyDecision } from '@agi-os/governance';
import type { BenchmarkSuite, BenchmarkScenario, BenchmarkResult, BenchmarkActual, BenchmarkCategory } from './types.js';

export class BenchmarkOrchestrator {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private results: Map<string, BenchmarkResult[]> = new Map();

  registerSuite(suite: Omit<BenchmarkSuite, 'id'>): BenchmarkSuite {
    const full: BenchmarkSuite = { id: generateId(), ...suite };
    this.suites.set(full.id, full);
    return full;
  }

  getSuite(suiteId: string): BenchmarkSuite | undefined {
    return this.suites.get(suiteId);
  }

  getAllSuites(): BenchmarkSuite[] {
    return [...this.suites.values()];
  }

  getSuitesByCategory(category: BenchmarkCategory): BenchmarkSuite[] {
    return [...this.suites.values()].filter(s => s.category === category);
  }

  runScenario(suiteId: string, scenarioId: string, actual: BenchmarkActual, model: string, provider: string): BenchmarkResult | undefined {
    const suite = this.suites.get(suiteId);
    if (!suite) return undefined;
    const scenario = suite.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return undefined;

    const passed = this.evaluate(scenario, actual);
    const score = this.calculateScore(scenario, actual);

    const result: BenchmarkResult = {
      id: generateId(),
      suiteId,
      scenarioId,
      model,
      provider,
      actual,
      passed,
      score,
      duration: actual.duration,
      timestamp: now().toISOString(),
    };

    const results = this.results.get(suiteId) ?? [];
    results.push(result);
    this.results.set(suiteId, results);
    return result;
  }

  private evaluate(scenario: BenchmarkScenario, actual: BenchmarkActual): boolean {
    const e = scenario.expected;
    if (e.outcome && actual.outcome !== e.outcome) return false;
    if (e.expectedTool && actual.toolUsed !== e.expectedTool) return false;
    if (e.expectedGovernance && actual.governanceDecision !== e.expectedGovernance) return false;
    if (e.minConfidence !== undefined && (actual.confidence ?? 0) < e.minConfidence) return false;
    if (e.maxDuration !== undefined && actual.duration > e.maxDuration) return false;
    return true;
  }

  private calculateScore(scenario: BenchmarkScenario, actual: BenchmarkActual): number {
    let score = 0;
    const e = scenario.expected;
    if (e.outcome === actual.outcome) score += 0.4;
    if (e.expectedTool && actual.toolUsed === e.expectedTool) score += 0.2;
    if (e.expectedGovernance && actual.governanceDecision === e.expectedGovernance) score += 0.2;
    if (e.minConfidence !== undefined && (actual.confidence ?? 0) >= e.minConfidence) score += 0.1;
    if (e.maxDuration !== undefined && actual.duration <= e.maxDuration) score += 0.1;
    return score;
  }

  getResults(suiteId: string): BenchmarkResult[] {
    return this.results.get(suiteId) ?? [];
  }

  getAllResults(): BenchmarkResult[] {
    return [...this.results.values()].flat();
  }

  getSuiteScore(suiteId: string): number {
    const results = this.results.get(suiteId) ?? [];
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }

  getOverallScore(): number {
    const all = this.getAllResults();
    if (all.length === 0) return 0;
    return all.reduce((sum, r) => sum + r.score, 0) / all.length;
  }

  clear(): void {
    this.suites.clear();
    this.results.clear();
  }
}
