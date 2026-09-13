import type { ScaffoldConfig, ScaffoldResult } from './types.js';

export class ScaffoldSensitivityTester {
  private configs: ScaffoldConfig[] = [];
  private results: ScaffoldResult[] = [];

  registerConfig(config: ScaffoldConfig): void {
    this.configs.push(config);
  }

  recordResult(result: ScaffoldResult): void {
    this.results.push(result);
  }

  getConfigs(): ScaffoldConfig[] {
    return [...this.configs];
  }

  getResults(): ScaffoldResult[] {
    return [...this.results];
  }

  calculateDelta(): { memoryDelta: number; replanDelta: number; verifierDelta: number } {
    const withMemory = this.results.filter((_, i) => this.configs[i]?.hasMemory);
    const withoutMemory = this.results.filter((_, i) => !this.configs[i]?.hasMemory);
    const withReplan = this.results.filter((_, i) => this.configs[i]?.hasReplanning);
    const withoutReplan = this.results.filter((_, i) => !this.configs[i]?.hasReplanning);
    const strictVerifier = this.results.filter((_, i) => this.configs[i]?.verifierStrict);
    const weakVerifier = this.results.filter((_, i) => !this.configs[i]?.verifierStrict);

    const avgSuccess = (arr: ScaffoldResult[]) => arr.length > 0 ? arr.filter(r => r.taskSuccess).length / arr.length : 0;

    return {
      memoryDelta: avgSuccess(withMemory) - avgSuccess(withoutMemory),
      replanDelta: avgSuccess(withReplan) - avgSuccess(withoutReplan),
      verifierDelta: avgSuccess(strictVerifier) - avgSuccess(weakVerifier),
    };
  }

  findBestConfig(): ScaffoldConfig | null {
    if (this.configs.length === 0 || this.results.length === 0) return null;
    let bestIdx = 0;
    let bestScore = 0;
    for (let i = 0; i < this.results.length; i++) {
      const score = this.results[i].taskSuccess ? this.results[i].safetyScore : 0;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    return this.configs[bestIdx] ?? null;
  }

  clear(): void {
    this.configs = [];
    this.results = [];
  }
}
