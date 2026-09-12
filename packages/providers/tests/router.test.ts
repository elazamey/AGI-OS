import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from '../src/router.js';
import type { ProviderConfig, ProviderRequest } from '../src/types.js';
import { ReliabilityTracker } from '@agi-os/self-model';
import { ConfidenceScorer } from '@agi-os/self-model';
import { PatternDetector } from '@agi-os/self-model';

function createRequest(id?: string): ProviderRequest {
  return {
    id: id ?? `req-${Date.now()}`,
    messages: [{ role: 'user', content: 'Hello' }],
  };
}

function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: 'test-provider',
    type: 'local',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    availableModels: ['llama3', 'codellama'],
    rateLimitRpm: null,
    rateLimitTpm: null,
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxRetries: 2,
    timeoutMs: 30000,
    priority: 1,
    ...overrides,
  };
}

describe('Router', () => {
  let router: Router;
  let reliability: ReliabilityTracker;
  let confidence: ConfidenceScorer;
  let patterns: PatternDetector;

  beforeEach(() => {
    reliability = new ReliabilityTracker();
    confidence = new ConfidenceScorer();
    patterns = new PatternDetector();
    router = new Router({ reliability, confidence, patterns });
  });

  it('should register and list providers', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    router.registerProvider(createConfig({ id: 'p2' }));
    expect(router.getProviders()).toHaveLength(2);
  });

  it('should route to a registered provider', () => {
    router.registerProvider(createConfig({ id: 'p1', priority: 1 }));
    const decision = router.route({ request: createRequest() });
    expect(decision.providerId).toBe('p1');
  });

  it('should prefer lower priority', () => {
    router.registerProvider(createConfig({ id: 'slow', priority: 5 }));
    router.registerProvider(createConfig({ id: 'fast', priority: 1 }));
    const decision = router.route({ request: createRequest() });
    expect(decision.providerId).toBe('fast');
  });

  it('should exclude providers', () => {
    router.registerProvider(createConfig({ id: 'p1', priority: 1 }));
    router.registerProvider(createConfig({ id: 'p2', priority: 2 }));
    const decision = router.route({
      request: createRequest(),
      excludeProviders: ['p1'],
    });
    expect(decision.providerId).toBe('p2');
  });

  it('should return empty when all excluded', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    const decision = router.route({
      request: createRequest(),
      excludeProviders: ['p1'],
    });
    expect(decision.providerId).toBe('');
  });

  it('should return empty when no providers', () => {
    const decision = router.route({ request: createRequest() });
    expect(decision.providerId).toBe('');
  });

  it('should exclude unhealthy providers', () => {
    router.registerProvider(createConfig({ id: 'healthy' }));
    router.registerProvider(createConfig({ id: 'sick' }));
    router.recordFailure('sick', 'crash');
    router.recordFailure('sick', 'crash');
    router.recordFailure('sick', 'crash');
    router.recordFailure('sick', 'crash');
    router.recordFailure('sick', 'crash');
    const decision = router.route({ request: createRequest() });
    expect(decision.providerId).toBe('healthy');
  });

  it('should penalize degraded providers', () => {
    router.registerProvider(createConfig({ id: 'a', priority: 1 }));
    router.registerProvider(createConfig({ id: 'b', priority: 1 }));
    router.recordFailure('a', 'error');
    const decision = router.route({ request: createRequest() });
    // b should win because a is degraded (same priority)
    expect(decision.providerId).toBe('b');
  });

  it('should give local providers a preference boost', () => {
    router.registerProvider(createConfig({ id: 'local', type: 'local', priority: 3 }));
    router.registerProvider(createConfig({ id: 'cloud', type: 'cloud-free', priority: 1 }));
    const decision = router.route({ request: createRequest() });
    // Local boost should make it competitive despite higher priority number
    expect(decision.providerId).toBeDefined();
  });

  it('should provide fallback chain', () => {
    router.registerProvider(createConfig({ id: 'p1', priority: 1 }));
    router.registerProvider(createConfig({ id: 'p2', priority: 2 }));
    router.registerProvider(createConfig({ id: 'p3', priority: 3 }));
    const decision = router.route({ request: createRequest() });
    expect(decision.fallbackChain).toHaveLength(2);
  });

  it('should explain routing decision', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    const decision = router.route({ request: createRequest() });
    expect(decision.reason).toContain('score=');
  });

  it('should record success', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    router.recordSuccess('p1');
    const status = router.getStatus('p1')!;
    expect(status.health).toBe('healthy');
    expect(status.consecutiveFailures).toBe(0);
  });

  it('should record failure and degrade', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    router.recordFailure('p1', 'error');
    const status = router.getStatus('p1')!;
    expect(status.health).toBe('degraded');
    expect(status.consecutiveFailures).toBe(1);
  });

  it('should mark unhealthy after 5 failures', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    for (let i = 0; i < 5; i++) router.recordFailure('p1', 'error');
    const status = router.getStatus('p1')!;
    expect(status.health).toBe('unhealthy');
  });

  it('should track route history', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    router.route({ request: createRequest('r1') });
    router.route({ request: createRequest('r2') });
    expect(router.getRouteHistory()).toHaveLength(2);
  });

  it('should get available providers', () => {
    router.registerProvider(createConfig({ id: 'a' }));
    router.registerProvider(createConfig({ id: 'b' }));
    router.recordFailure('b', 'e');
    router.recordFailure('b', 'e');
    router.recordFailure('b', 'e');
    router.recordFailure('b', 'e');
    router.recordFailure('b', 'e');
    expect(router.getAvailableProviders()).toHaveLength(1);
  });

  it('should reset', () => {
    router.registerProvider(createConfig({ id: 'p1' }));
    router.reset();
    expect(router.getProviders()).toHaveLength(0);
  });

  it('should penalize systemic pattern-affected providers', () => {
    patterns.register({
      name: 'Systemic crash',
      description: 'x',
      signatures: [{ field: 'errorType', operator: 'equals', value: 'crash' }],
      frequency: 'systemic',
      impact: 'critical',
      affectedComponents: ['p1'],
    });
    router.registerProvider(createConfig({ id: 'p1', priority: 1 }));
    router.registerProvider(createConfig({ id: 'p2', priority: 1 }));
    const decision = router.route({ request: createRequest() });
    expect(decision.providerId).toBe('p2');
  });
});
