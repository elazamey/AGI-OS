// ============================================================================
// AGI OS - Provider Router
// Fallback engine — reads ReliabilityTracker & ConfidenceScorer from Phase 9
// to make intelligent routing decisions
// ============================================================================

import type {
  ProviderConfig,
  ProviderStatus,
  RouteDecision,
  RouteContext,
} from './types.js';
import type { ReliabilityTracker, ConfidenceScorer, PatternDetector } from '@agi-os/self-model';

// ---------------------------------------------------------------------------
// Router — intelligent provider selection
// ---------------------------------------------------------------------------
export class Router {
  private providers: Map<string, ProviderConfig> = new Map();
  private statuses: Map<string, ProviderStatus> = new Map();
  private reliability: ReliabilityTracker;
  private confidence: ConfidenceScorer;
  private patterns: PatternDetector;
  private routeHistory: Array<{ requestId: string; providerId: string; reason: string; timestamp: string }> = [];

  constructor(deps: {
    reliability: ReliabilityTracker;
    confidence: ConfidenceScorer;
    patterns: PatternDetector;
  }) {
    this.reliability = deps.reliability;
    this.confidence = deps.confidence;
    this.patterns = deps.patterns;
  }

  /**
   * Register a provider for routing
   */
  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
    this.statuses.set(config.id, {
      providerId: config.id,
      health: 'healthy',
      lastCheckAt: new Date().toISOString(),
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      requestsInWindow: 0,
      windowStartedAt: new Date().toISOString(),
    });
  }

  /**
   * Remove a provider from routing
   */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.statuses.delete(providerId);
  }

  /**
   * Update provider health status
   */
  updateStatus(providerId: string, update: Partial<ProviderStatus>): void {
    const status = this.statuses.get(providerId);
    if (status) {
      Object.assign(status, update);
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(providerId: string): void {
    const status = this.statuses.get(providerId);
    if (status) {
      status.lastSuccessAt = new Date().toISOString();
      status.consecutiveFailures = 0;
      status.health = 'healthy';
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(providerId: string, error?: string): void {
    const status = this.statuses.get(providerId);
    if (status) {
      status.lastFailureAt = new Date().toISOString();
      status.consecutiveFailures++;
      status.health = status.consecutiveFailures >= 5 ? 'unhealthy' : 'degraded';
      status.error = error;
    }
  }

  /**
   * Record a rate limit hit
   */
  recordRateLimit(providerId: string): void {
    const status = this.statuses.get(providerId);
    if (status) {
      status.health = 'degraded';
      status.requestsInWindow++;
    }
  }

  /**
   * Core routing decision — picks the best provider given context
   */
  route(context: RouteContext): RouteDecision {
    const exclude = new Set(context.excludeProviders ?? []);
    const candidates = this.getOrderedCandidates(exclude);

    if (candidates.length === 0) {
      return {
        providerId: '',
        model: '',
        reason: 'No available providers after exclusions',
        fallbackChain: [],
        confidence: 0,
      };
    }

    // Score each candidate
    const scored = candidates.map((config) => ({
      config,
      score: this.scoreProvider(config, context),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const fallbackChain = scored.slice(1).map((s) => s.config.id);

    const decision: RouteDecision = {
      providerId: best.config.id,
      model: context.preferredModel ?? best.config.defaultModel,
      reason: this.explainChoice(best.config, best.score, scored),
      fallbackChain,
      confidence: Math.min(1, best.score),
    };

    this.routeHistory.push({
      requestId: context.request.id,
      providerId: decision.providerId,
      reason: decision.reason,
      timestamp: new Date().toISOString(),
    });

    return decision;
  }

  /**
   * Get all registered providers
   */
  getProviders(): ProviderConfig[] {
    return [...this.providers.values()];
  }

  /**
   * Get provider status
   */
  getStatus(providerId: string): ProviderStatus | undefined {
    return this.statuses.get(providerId);
  }

  /**
   * Get all statuses
   */
  getStatuses(): ProviderStatus[] {
    return [...this.statuses.values()];
  }

  /**
   * Get route history
   */
  getRouteHistory(): Array<{ requestId: string; providerId: string; reason: string; timestamp: string }> {
    return [...this.routeHistory];
  }

  /**
   * Get available providers (healthy or degraded)
   */
  getAvailableProviders(): ProviderConfig[] {
    return this.getProviders().filter((config) => {
      const status = this.statuses.get(config.id);
      return status && (status.health === 'healthy' || status.health === 'degraded');
    });
  }

  /**
   * Reset
   */
  reset(): void {
    this.providers.clear();
    this.statuses.clear();
    this.routeHistory = [];
  }

  // ---- Private -----------------------------------------------------------

  private getOrderedCandidates(exclude: Set<string>): ProviderConfig[] {
    return this.getProviders()
      .filter((c) => !exclude.has(c.id))
      .filter((c) => {
        const status = this.statuses.get(c.id);
        return status && status.health !== 'offline' && status.health !== 'unhealthy';
      })
      .sort((a, b) => a.priority - b.priority);
  }

  private scoreProvider(config: ProviderConfig, context: RouteContext): number {
    let score = 1.0;

    // 1. Priority weight (lower priority = better, max 0.3 boost)
    score += (10 - Math.min(10, config.priority)) * 0.03;

    // 2. Reliability from Phase 9 (max 0.3 boost)
    const rec = this.reliability.getRecord(config.id);
    if (rec) {
      score += rec.successRate * 0.3;
      // Penalty for high MTTR (slow recovery)
      if (rec.mttr > 30000) score -= 0.1;
    }

    // 3. Failure patterns — penalty if systemic (max -0.2)
    const systemic = this.patterns.getSystemicPatterns();
    const affectedBySystemic = systemic.filter(
      (p) => p.affectedComponents.includes(config.id)
    );
    score -= affectedBySystemic.length * 0.1;

    // 4. Health status
    const status = this.statuses.get(config.id);
    if (status) {
      if (status.health === 'degraded') score -= 0.15;
      if (status.consecutiveFailures > 0) score -= status.consecutiveFailures * 0.05;
    }

    // 5. Local providers get a preference boost (free & reliable)
    if (config.type === 'local') score += 0.1;

    // 6. Model availability check
    if (context.preferredModel && config.availableModels.includes(context.preferredModel)) {
      score += 0.1;
    }

    return Math.max(0, score);
  }

  private explainChoice(
    config: ProviderConfig,
    score: number,
    scored: Array<{ config: ProviderConfig; score: number }>
  ): string {
    const reasons: string[] = [];

    reasons.push(`score=${score.toFixed(2)}`);
    reasons.push(`priority=${config.priority}`);
    reasons.push(`type=${config.type}`);

    const rec = this.reliability.getRecord(config.id);
    if (rec) {
      reasons.push(`reliability=${(rec.successRate * 100).toFixed(0)}%`);
    }

    const status = this.statuses.get(config.id);
    if (status) {
      reasons.push(`health=${status.health}`);
      reasons.push(`failures=${status.consecutiveFailures}`);
    }

    if (scored.length > 1) {
      const runner = scored[1];
      const delta = (score - runner.score).toFixed(2);
      reasons.push(`margin=+${delta} over ${runner.config.id}`);
    }

    return reasons.join(', ');
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createRouter(deps: {
  reliability: ReliabilityTracker;
  confidence: ConfidenceScorer;
  patterns: PatternDetector;
}): Router {
  return new Router(deps);
}
