import type { DriftResult } from './types.js';

export class DriftDetector {
  private baseline = new Map<string, number>();
  private current = new Map<string, number>();

  setBaseline(metric: string, value: number): void {
    this.baseline.set(metric, value);
  }

  recordCurrent(metric: string, value: number): void {
    this.current.set(metric, value);
  }

  detectDrift(threshold: number): DriftResult[] {
    const results: DriftResult[] = [];

    for (const [metric, baselineValue] of this.baseline) {
      const currentValue = this.current.get(metric) ?? baselineValue;
      const diff = Math.abs(currentValue - baselineValue);
      const drifted = diff > threshold;

      let severity = 'none';
      if (drifted) {
        const ratio = diff / (baselineValue || 1);
        if (ratio > 0.5) severity = 'critical';
        else if (ratio > 0.2) severity = 'high';
        else if (ratio > 0.1) severity = 'medium';
        else severity = 'low';
      }

      results.push({
        metric,
        baseline: baselineValue,
        current: currentValue,
        drifted,
        severity,
      });
    }

    return results;
  }

  isHealthy(): boolean {
    const results = this.detectDrift(0.1);
    return results.every(r => !r.drifted);
  }
}
