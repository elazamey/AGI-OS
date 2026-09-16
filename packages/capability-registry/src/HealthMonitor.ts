// ═══════════════════════════════════════════════════════
// HealthMonitor — Endpoint Liveness & Status Tracking
// ═══════════════════════════════════════════════════════

import type { RepositoryCapability, HealthCheckResult, CapabilityStatus } from './types';

export interface HealthMonitorConfig {
  timeoutMs: number;
  checkIntervalMs: number;
  retriesBeforeDown: number;
}

const DEFAULT_CONFIG: HealthMonitorConfig = {
  timeoutMs: 5000,
  checkIntervalMs: 30000,
  retriesBeforeDown: 3,
};

export class HealthMonitor {
  private config: HealthMonitorConfig;
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private failureCounts: Map<string, number> = new Map();

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkHealth(cap: RepositoryCapability): Promise<HealthCheckResult> {
    const start = Date.now();
    const result: HealthCheckResult = {
      capabilityId: cap.id,
      status: 'UNKNOWN',
      latencyMs: 0,
      timestamp: Date.now(),
    };

    if (!cap.endpoint && !cap.healthCheckUrl) {
      result.status = 'UNKNOWN';
      result.latencyMs = 0;
      this.recordResult(cap.id, result);
      return result;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(cap.healthCheckUrl || cap.endpoint!, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      result.latencyMs = Date.now() - start;
      result.status = response.ok ? 'HEALTHY' : 'DEGRADED';

      if (!response.ok) {
        this.incrementFailure(cap.id);
        if (this.failureCounts.get(cap.id)! >= this.config.retriesBeforeDown) {
          result.status = 'DOWN';
        }
      } else {
        this.resetFailure(cap.id);
      }
    } catch (err: unknown) {
      result.latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      result.error = message;
      this.incrementFailure(cap.id);

      if (this.failureCounts.get(cap.id)! >= this.config.retriesBeforeDown) {
        result.status = 'DOWN';
      } else {
        result.status = 'DEGRADED';
      }
    }

    this.recordResult(cap.id, result);
    return result;
  }

  async checkAllHealth(caps: RepositoryCapability[]): Promise<HealthCheckResult[]> {
    return Promise.all(caps.map(cap => this.checkHealth(cap)));
  }

  simulateHealth(cap: RepositoryCapability, status: CapabilityStatus, latencyMs: number = 50): HealthCheckResult {
    const result: HealthCheckResult = {
      capabilityId: cap.id,
      status,
      latencyMs,
      timestamp: Date.now(),
    };
    this.recordResult(cap.id, result);
    return result;
  }

  getHealthHistory(capabilityId: string): HealthCheckResult[] {
    return this.healthHistory.get(capabilityId) || [];
  }

  getLastHealthCheck(capabilityId: string): HealthCheckResult | undefined {
    const history = this.healthHistory.get(capabilityId);
    return history ? history[history.length - 1] : undefined;
  }

  getUnhealthyCapabilities(caps: RepositoryCapability[]): RepositoryCapability[] {
    return caps.filter(cap => {
      const last = this.getLastHealthCheck(cap.id);
      return last && (last.status === 'DOWN' || last.status === 'DEGRADED');
    });
  }

  private recordResult(capabilityId: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(capabilityId)) {
      this.healthHistory.set(capabilityId, []);
    }
    const history = this.healthHistory.get(capabilityId)!;
    history.push(result);
    if (history.length > 100) history.shift();
  }

  private incrementFailure(capabilityId: string): void {
    this.failureCounts.set(capabilityId, (this.failureCounts.get(capabilityId) || 0) + 1);
  }

  private resetFailure(capabilityId: string): void {
    this.failureCounts.set(capabilityId, 0);
  }

  getFailureCount(capabilityId: string): number {
    return this.failureCounts.get(capabilityId) || 0;
  }
}
