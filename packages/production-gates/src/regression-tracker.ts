import { now } from '@agi-os/kernel';
import type { RegressionThreshold, RegressionCheck } from './types.js';

export class RegressionTracker {
  private baselines: Map<string, RegressionThreshold> = new Map();
  private history: Array<{ timestamp: string; checks: RegressionCheck[] }> = [];

  setBaseline(metric: string, baseline: number, threshold: number, unit: string): void {
    this.baselines.set(metric, { metric, baseline, threshold, unit });
  }

  getBaseline(metric: string): RegressionThreshold | undefined {
    return this.baselines.get(metric);
  }

  check(metric: string, currentValue: number): RegressionCheck {
    const baseline = this.baselines.get(metric);
    if (!baseline) {
      return { metric, baseline: 0, current: currentValue, passed: true, deviation: 0 };
    }
    const deviation = Math.abs(currentValue - baseline.baseline) / baseline.baseline;
    const passed = deviation <= baseline.threshold;
    return { metric, baseline: baseline.baseline, current: currentValue, passed, deviation };
  }

  checkAll(values: Record<string, number>): RegressionCheck[] {
    const checks: RegressionCheck[] = [];
    for (const [metric, value] of Object.entries(values)) {
      checks.push(this.check(metric, value));
    }
    this.history.push({ timestamp: now().toISOString(), checks });
    return checks;
  }

  getHistory(): Array<{ timestamp: string; checks: RegressionCheck[] }> {
    return [...this.history];
  }

  getBaselines(): RegressionThreshold[] {
    return Array.from(this.baselines.values());
  }
}
