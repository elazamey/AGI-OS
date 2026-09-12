// ============================================================================
// AGI OS - Reliability Tracker
// MTBF, MTTR, uptime, failure history for tools/providers/modules
// ============================================================================

import { now } from '@agi-os/kernel';
import type { ReliabilityRecord, FailureEvent } from './types.js';

// ---------------------------------------------------------------------------
// ReliabilityTracker — monitors component reliability
// ---------------------------------------------------------------------------
export class ReliabilityTracker {
  private records: Map<string, ReliabilityRecord> = new Map();

  /**
   * Get or create a record for a component
   */
  getOrCreate(componentId: string, componentType: ReliabilityRecord['componentType']): ReliabilityRecord {
    let rec = this.records.get(componentId);
    if (!rec) {
      rec = {
        componentId,
        componentType,
        successRate: 0,
        mtbf: 0,
        mttr: 0,
        lastFailureAt: null,
        lastRecoveryAt: null,
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
        totalUptimeMs: 0,
        totalDowntimeMs: 0,
        failureHistory: [],
      };
      this.records.set(componentId, rec);
    }
    return rec;
  }

  /**
   * Record a success for a component
   */
  recordSuccess(componentId: string, durationMs: number): void {
    const rec = this.records.get(componentId);
    if (!rec) return;

    rec.consecutiveSuccesses++;
    rec.consecutiveFailures = 0;
    rec.totalUptimeMs += durationMs;

    this.recomputeStats(rec);
  }

  /**
   * Record a failure for a component
   */
  recordFailure(componentId: string, errorType: string, errorMessage: string, durationMs: number): void {
    const rec = this.records.get(componentId);
    if (!rec) return;

    const ts = now().toISOString();
    rec.consecutiveFailures++;
    rec.consecutiveSuccesses = 0;
    rec.lastFailureAt = ts;
    rec.totalDowntimeMs += durationMs;

    rec.failureHistory.push({
      timestamp: ts,
      errorType,
      errorMessage,
      recovered: false,
      recoveryTimeMs: null,
    });

    this.recomputeStats(rec);
  }

  /**
   * Record recovery from a failure
   */
  recordRecovery(componentId: string, recoveryTimeMs: number): void {
    const rec = this.records.get(componentId);
    if (!rec) return;

    rec.lastRecoveryAt = now().toISOString();
    rec.totalDowntimeMs += recoveryTimeMs;

    // Mark last failure as recovered
    const lastFailure = rec.failureHistory[rec.failureHistory.length - 1];
    if (lastFailure && !lastFailure.recovered) {
      lastFailure.recovered = true;
      lastFailure.recoveryTimeMs = recoveryTimeMs;
    }

    this.recomputeStats(rec);
  }

  /**
   * Get record for a component
   */
  getRecord(componentId: string): ReliabilityRecord | undefined {
    return this.records.get(componentId);
  }

  /**
   * Get all records
   */
  getRecords(): ReliabilityRecord[] {
    return [...this.records.values()];
  }

  /**
   * Get records by type
   */
  getByType(type: ReliabilityRecord['componentType']): ReliabilityRecord[] {
    return this.getRecords().filter((r) => r.componentType === type);
  }

  /**
   * Get most reliable components
   */
  getMostReliable(n: number): ReliabilityRecord[] {
    return this.getRecords()
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, n);
  }

  /**
   * Get least reliable components
   */
  getLeastReliable(n: number): ReliabilityRecord[] {
    return this.getRecords()
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, n);
  }

  /**
   * Get components currently failing (consecutive failures > 0)
   */
  getCurrentlyFailing(): ReliabilityRecord[] {
    return this.getRecords().filter((r) => r.consecutiveFailures > 0);
  }

  /**
   * Get failure history for a component
   */
  getFailureHistory(componentId: string): FailureEvent[] {
    return this.records.get(componentId)?.failureHistory ?? [];
  }

  /**
   * Calculate overall system reliability
   */
  getOverallReliability(): number {
    const records = this.getRecords();
    if (records.length === 0) return 0;
    return records.reduce((s, r) => s + r.successRate, 0) / records.length;
  }

  /**
   * Reset a specific component
   */
  resetComponent(componentId: string): void {
    this.records.delete(componentId);
  }

  /**
   * Reset all
   */
  reset(): void {
    this.records.clear();
  }

  // ---- Private -----------------------------------------------------------

  private recomputeStats(rec: ReliabilityRecord): void {
    const total = rec.totalUptimeMs + rec.totalDowntimeMs;
    rec.successRate = total > 0 ? rec.totalUptimeMs / total : 0;

    // MTBF: mean time between failures
    const totalFailures = rec.failureHistory.length;
    rec.mtbf = totalFailures > 0 ? rec.totalUptimeMs / totalFailures : rec.totalUptimeMs;

    // MTTR: mean time to repair
    const recovered = rec.failureHistory.filter((f) => f.recovered && f.recoveryTimeMs !== null);
    rec.mttr = recovered.length > 0
      ? recovered.reduce((s, f) => s + (f.recoveryTimeMs ?? 0), 0) / recovered.length
      : 0;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createReliabilityTracker(): ReliabilityTracker {
  return new ReliabilityTracker();
}
