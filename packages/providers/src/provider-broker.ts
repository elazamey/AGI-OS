// ============================================================================
// AGI OS - ProviderBroker
// Orchestrates adapters + router + cost guard for seamless provider resolution
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderAdapter,
  RouteContext,
} from './types.js';
import { CostGuard } from './cost-guard.js';
import { Router } from './router.js';
import type { ReliabilityTracker, ConfidenceScorer, PatternDetector } from '@agi-os/self-model';

// ---------------------------------------------------------------------------
// ProviderBroker — the unified entry point for LLM requests
// ---------------------------------------------------------------------------
export class ProviderBroker {
  private adapters: Map<string, ProviderAdapter> = new Map();
  private router: Router;
  private costGuard: CostGuard;
  private reliability: ReliabilityTracker;
  private requestLog: Array<{
    requestId: string;
    providerId: string;
    success: boolean;
    latencyMs: number;
    timestamp: string;
  }> = [];

  constructor(deps: {
    reliability: ReliabilityTracker;
    confidence: ConfidenceScorer;
    patterns: PatternDetector;
    costGuard?: CostGuard;
  }) {
    this.reliability = deps.reliability;
    this.router = new Router({
      reliability: deps.reliability,
      confidence: deps.confidence,
      patterns: deps.patterns,
    });
    this.costGuard = deps.costGuard ?? new CostGuard();
  }

  /**
   * Register a provider adapter + config
   */
  register(adapter: ProviderAdapter, config?: Partial<ProviderConfig>): void {
    const mergedConfig: ProviderConfig = {
      ...adapter.config,
      ...config,
    };

    // CostGuard validation: must be $0
    const validation = this.costGuard.validateProviderConfig(mergedConfig);
    if (!validation.valid) {
      throw new Error(`CostGuard rejected provider "${mergedConfig.id}": ${validation.errors.join('; ')}`);
    }

    this.adapters.set(adapter.id, adapter);
    this.router.registerProvider(mergedConfig);
  }

  /**
   * Unregister a provider
   */
  unregister(providerId: string): void {
    this.adapters.delete(providerId);
    this.router.unregisterProvider(providerId);
  }

  /**
   * Send a completion request — routes to best provider with fallback
   */
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const requestId = request.id || generateId();

    // Cost check (estimate $0 for all local/free providers)
    const estimatedCost = 0;
    const costCheck = this.costGuard.check(estimatedCost);
    if (!costCheck.allowed) {
      return {
        id: `blocked-${Date.now()}`,
        requestId,
        providerId: '',
        model: '',
        content: '',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 0,
        timestamp: now().toISOString(),
        error: `CostGuard: ${costCheck.reason}`,
      };
    }

    // Route to best provider
    const routeContext: RouteContext = {
      request: { ...request, id: requestId },
      excludeProviders: request.metadata?.excludeProviders as string[] | undefined,
      preferredModel: request.model,
    };

    const decision = this.router.route(routeContext);

    if (!decision.providerId) {
      return {
        id: `no-provider-${Date.now()}`,
        requestId,
        providerId: '',
        model: '',
        content: '',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 0,
        timestamp: now().toISOString(),
        error: 'No available providers',
      };
    }

    // Try primary + fallback chain
    const allProviders = [decision.providerId, ...decision.fallbackChain];

    for (const providerId of allProviders) {
      const adapter = this.adapters.get(providerId);
      if (!adapter) continue;

      const overrideModel = providerId === decision.providerId ? decision.model : undefined;
      const adaptedRequest: ProviderRequest = {
        ...request,
        id: requestId,
        model: overrideModel,
      };

      try {
        const response = await adapter.complete(adaptedRequest);

        // Record telemetry
        this.reliability.getOrCreate(providerId, 'provider');
        if (response.finishReason === 'error' || response.finishReason === 'rate_limit') {
          this.reliability.recordFailure(
            providerId,
            response.finishReason,
            response.error ?? 'unknown',
            response.latencyMs
          );
          this.router.recordFailure(providerId, response.error);
          continue; // try next in fallback chain
        }

        this.reliability.recordSuccess(providerId, response.latencyMs);
        this.router.recordSuccess(providerId);
        this.costGuard.recordSpend(0);

        this.requestLog.push({
          requestId,
          providerId,
          success: true,
          latencyMs: response.latencyMs,
          timestamp: now().toISOString(),
        });

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.reliability.getOrCreate(providerId, 'provider');
        this.reliability.recordFailure(providerId, 'exception', message, 0);
        this.router.recordFailure(providerId, message);
        continue;
      }
    }

    // All providers failed
    this.requestLog.push({
      requestId,
      providerId: decision.providerId,
      success: false,
      latencyMs: 0,
      timestamp: now().toISOString(),
    });

    return {
      id: `all-failed-${Date.now()}`,
      requestId,
      providerId: decision.providerId,
      model: decision.model,
      content: '',
      finishReason: 'error',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: 0,
      timestamp: now().toISOString(),
      error: `All providers failed: ${allProviders.join(', ')}`,
    };
  }

  /**
   * Health check all registered providers
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const checks = [...this.adapters.entries()].map(async ([id, adapter]) => {
      results[id] = await adapter.healthCheck();
    });
    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Health check a single provider
   */
  async healthCheck(providerId: string): Promise<boolean> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) return false;
    return adapter.healthCheck();
  }

  /**
   * Get the router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get the cost guard
   */
  getCostGuard(): CostGuard {
    return this.costGuard;
  }

  /**
   * Get request log
   */
  getRequestLog(): typeof this.requestLog {
    return [...this.requestLog];
  }

  /**
   * Get registered provider IDs
   */
  getProviderIds(): string[] {
    return [...this.adapters.keys()];
  }

  /**
   * Get adapter by ID
   */
  getAdapter(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  /**
   * Reset
   */
  reset(): void {
    this.adapters.clear();
    this.router.reset();
    this.costGuard.reset();
    this.requestLog = [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createProviderBroker(deps: {
  reliability: ReliabilityTracker;
  confidence: ConfidenceScorer;
  patterns: PatternDetector;
  costGuard?: CostGuard;
}): ProviderBroker {
  return new ProviderBroker(deps);
}
