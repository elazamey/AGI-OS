import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderBroker } from '../src/provider-broker.js';
import { CostGuard } from '../src/cost-guard.js';
import { OllamaAdapter } from '../src/adapters/ollama.js';
import { ReliabilityTracker, ConfidenceScorer, PatternDetector } from '@agi-os/self-model';

describe('ProviderBroker', () => {
  let broker: ProviderBroker;
  let reliability: ReliabilityTracker;
  let confidence: ConfidenceScorer;
  let patterns: PatternDetector;

  beforeEach(() => {
    reliability = new ReliabilityTracker();
    confidence = new ConfidenceScorer();
    patterns = new PatternDetector();
    broker = new ProviderBroker({ reliability, confidence, patterns });
    vi.restoreAllMocks();
  });

  it('should register a provider', () => {
    broker.register(new OllamaAdapter());
    expect(broker.getProviderIds()).toContain('ollama');
  });

  it('should reject paid providers via CostGuard', () => {
    expect(() => {
      broker.register(new OllamaAdapter(), {
        costPerInputToken: 0.001,
        costPerOutputToken: 0,
      });
    }).toThrow('CostGuard rejected');
  });

  it('should complete through registered provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Success' },
        eval_count: 10,
        prompt_eval_count: 5,
        done: true,
      }),
    }));

    broker.register(new OllamaAdapter());
    const response = await broker.complete({
      id: 'test-b1',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.content).toBe('Success');
    expect(response.providerId).toBe('ollama');
  });

  it('should return error when no providers registered', async () => {
    const response = await broker.complete({
      id: 'test-b2',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(response.finishReason).toBe('error');
    expect(response.error).toContain('No available providers');
  });

  it('should fallback on provider failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Fallback success' },
        eval_count: 10,
        prompt_eval_count: 5,
        done: true,
      }),
    }));

    broker.register(new OllamaAdapter({ id: 'primary', priority: 1 }));
    broker.register(new OllamaAdapter({ id: 'fallback', priority: 2, baseUrl: 'http://localhost:11435' }));

    // Mark primary as unhealthy in the router (not just reliability tracker)
    broker.getRouter().recordFailure('primary', 'down');
    broker.getRouter().recordFailure('primary', 'down');
    broker.getRouter().recordFailure('primary', 'down');
    broker.getRouter().recordFailure('primary', 'down');
    broker.getRouter().recordFailure('primary', 'down');

    const response = await broker.complete({
      id: 'test-b3',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.providerId).toBe('fallback');
  });

  it('should record telemetry on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Done' },
        eval_count: 10,
        prompt_eval_count: 5,
        done: true,
      }),
    }));

    broker.register(new OllamaAdapter());
    await broker.complete({
      id: 'test-b4',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const rec = reliability.getRecord('ollama');
    expect(rec).toBeDefined();
    expect(rec!.consecutiveSuccesses).toBe(1);
  });

  it('should record telemetry on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('crash')));

    broker.register(new OllamaAdapter());
    await broker.complete({
      id: 'test-b5',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const rec = reliability.getRecord('ollama');
    expect(rec).toBeDefined();
    expect(rec!.consecutiveFailures).toBe(1);
  });

  it('should track request log', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Done' },
        eval_count: 10,
        prompt_eval_count: 5,
        done: true,
      }),
    }));

    broker.register(new OllamaAdapter());
    await broker.complete({
      id: 'test-b6',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(broker.getRequestLog()).toHaveLength(1);
    expect(broker.getRequestLog()[0].success).toBe(true);
  });

  it('should health check all providers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    broker.register(new OllamaAdapter());
    const results = await broker.healthCheckAll();
    expect(results['ollama']).toBeDefined();
  });

  it('should get cost guard', () => {
    expect(broker.getCostGuard()).toBeDefined();
  });

  it('should get router', () => {
    expect(broker.getRouter()).toBeDefined();
  });

  it('should reset', () => {
    broker.register(new OllamaAdapter());
    broker.reset();
    expect(broker.getProviderIds()).toHaveLength(0);
    expect(broker.getRequestLog()).toHaveLength(0);
  });

  it('should get adapter by ID', () => {
    broker.register(new OllamaAdapter());
    expect(broker.getAdapter('ollama')).toBeDefined();
    expect(broker.getAdapter('nonexistent')).toBeUndefined();
  });
});
