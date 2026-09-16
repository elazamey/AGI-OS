import type { ResourceExhaustionResult } from './types.js';

export class ResourceExhaustionMonitor {
  private limits = {
    cpuPercent: 90,
    memoryMB: 4096,
    diskMB: 10240,
    tokenCount: 100000,
    toolCallCount: 200,
  };

  check(metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    tokenCount: number;
    toolCallCount: number;
  }): ResourceExhaustionResult {
    const budgetExceeded =
      metrics.cpuUsage > this.limits.cpuPercent ||
      metrics.memoryUsage > this.limits.memoryMB ||
      metrics.diskUsage > this.limits.diskMB ||
      metrics.tokenCount > this.limits.tokenCount ||
      metrics.toolCallCount > this.limits.toolCallCount;

    const killSwitchTriggered = budgetExceeded;

    return { ...metrics, budgetExceeded, killSwitchTriggered };
  }

  setLimits(limits: Partial<typeof this.limits>): void {
    Object.assign(this.limits, limits);
  }

  getLimits(): typeof this.limits {
    return { ...this.limits };
  }
}
