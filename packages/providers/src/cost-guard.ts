// ============================================================================
// AGI OS - CostGuard
// Hard-stop $0 enforcement gate — blocks any request that risks financial charge
// ============================================================================

import { now } from '@agi-os/kernel';
import type { CostGuardConfig, CostGuardState, CostCheckResult } from './types.js';

// ---------------------------------------------------------------------------
// CostGuard — $0 enforcement
// ---------------------------------------------------------------------------
export class CostGuard {
  private config: CostGuardConfig;
  private state: CostGuardState;

  constructor(config?: Partial<CostGuardConfig>) {
    this.config = {
      maxSpendPerRequest: 0,
      maxSpendPerDay: 0,
      maxSpendTotal: 0,
      warnAtPercent: 80,
      blockOnQuotaExhausted: true,
      ...config,
    };
    this.state = {
      spentToday: 0,
      spentTotal: 0,
      requestCount: 0,
      blockedCount: 0,
      lastResetAt: now().toISOString(),
    };
  }

  /**
   * Pre-flight cost check before sending a request
   */
  check(estimatedCost: number): CostCheckResult {
    // Hard block: any non-zero cost is rejected
    if (estimatedCost > 0) {
      this.state.blockedCount++;
      return {
        allowed: false,
        reason: `Cost $${estimatedCost.toFixed(6)} exceeds $0 limit. All requests must be free.`,
        estimatedCost,
        remainingDaily: this.config.maxSpendPerDay - this.state.spentToday,
        remainingTotal: this.config.maxSpendTotal - this.state.spentTotal,
      };
    }

    // Per-request limit check
    if (estimatedCost > this.config.maxSpendPerRequest) {
      this.state.blockedCount++;
      return {
        allowed: false,
        reason: `Estimated cost $${estimatedCost.toFixed(6)} exceeds per-request limit $${this.config.maxSpendPerRequest}`,
        estimatedCost,
        remainingDaily: this.config.maxSpendPerDay - this.state.spentToday,
        remainingTotal: this.config.maxSpendTotal - this.state.spentTotal,
      };
    }

    // Daily limit check
    this.resetDailyIfNeeded();
    if (this.state.spentToday >= this.config.maxSpendPerDay && this.config.maxSpendPerDay > 0) {
      this.state.blockedCount++;
      return {
        allowed: false,
        reason: `Daily spend limit $${this.config.maxSpendPerDay} reached. Spent: $${this.state.spentToday.toFixed(6)}`,
        estimatedCost,
        remainingDaily: 0,
        remainingTotal: this.config.maxSpendTotal - this.state.spentTotal,
      };
    }

    // Total limit check
    if (this.state.spentTotal >= this.config.maxSpendTotal && this.config.maxSpendTotal > 0) {
      this.state.blockedCount++;
      return {
        allowed: false,
        reason: `Total spend limit $${this.config.maxSpendTotal} reached. Spent: $${this.state.spentTotal.toFixed(6)}`,
        estimatedCost,
        remainingDaily: this.config.maxSpendPerDay - this.state.spentToday,
        remainingTotal: 0,
      };
    }

    return {
      allowed: true,
      reason: 'OK — $0 cost verified',
      estimatedCost,
      remainingDaily: this.config.maxSpendPerDay - this.state.spentToday,
      remainingTotal: this.config.maxSpendTotal - this.state.spentTotal,
    };
  }

  /**
   * Record actual spend after a request completes
   */
  recordSpend(amount: number): void {
    if (amount < 0) throw new Error('Spend amount cannot be negative');
    this.state.spentToday += amount;
    this.state.spentTotal += amount;
    this.state.requestCount++;
  }

  /**
   * Record a blocked request (cost guard prevented it)
   */
  recordBlock(): void {
    this.state.blockedCount++;
  }

  /**
   * Validate a provider config — all costs must be $0
   */
  validateProviderConfig(config: { costPerInputToken: number; costPerOutputToken: number; id: string }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (config.costPerInputToken > 0) {
      errors.push(`Provider "${config.id}" has non-zero input cost: $${config.costPerInputToken}`);
    }
    if (config.costPerOutputToken > 0) {
      errors.push(`Provider "${config.id}" has non-zero output cost: $${config.costPerOutputToken}`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Estimate cost for a token count (must return 0 for free providers)
   */
  estimateCost(providerConfig: { costPerInputToken: number; costPerOutputToken: number }, inputTokens: number, outputTokens: number): number {
    return (providerConfig.costPerInputToken * inputTokens) + (providerConfig.costPerOutputToken * outputTokens);
  }

  /**
   * Check if warning threshold is hit
   */
  isWarning(): boolean {
    if (this.config.maxSpendPerDay <= 0) return false;
    this.resetDailyIfNeeded();
    const percent = (this.state.spentToday / this.config.maxSpendPerDay) * 100;
    return percent >= this.config.warnAtPercent;
  }

  /**
   * Get current state snapshot
   */
  getState(): CostGuardState {
    this.resetDailyIfNeeded();
    return { ...this.state };
  }

  /**
   * Get config
   */
  getConfig(): CostGuardConfig {
    return { ...this.config };
  }

  /**
   * Reset daily counters (if day changed)
   */
  resetDailyIfNeeded(): void {
    const lastReset = new Date(this.state.lastResetAt);
    const nowDate = new Date(now());
    if (lastReset.toDateString() !== nowDate.toDateString()) {
      this.state.spentToday = 0;
      this.state.lastResetAt = now().toISOString();
    }
  }

  /**
   * Force reset all counters
   */
  reset(): void {
    this.state = {
      spentToday: 0,
      spentTotal: 0,
      requestCount: 0,
      blockedCount: 0,
      lastResetAt: now().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createCostGuard(config?: Partial<CostGuardConfig>): CostGuard {
  return new CostGuard(config);
}
