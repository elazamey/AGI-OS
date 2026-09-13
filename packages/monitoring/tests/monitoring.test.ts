import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, TokenTracker, PrometheusExporter, AuditLogger } from '../src/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should create with default config', () => {
    expect(collector).toBeDefined();
    expect(collector.size()).toBe(0);
  });

  it('should record metrics', () => {
    collector.record('test_metric', 42, { env: 'test' });
    expect(collector.size()).toBe(1);
  });

  it('should increment metrics', () => {
    collector.increment('counter', { env: 'test' });
    collector.increment('counter', { env: 'test' });
    expect(collector.size()).toBe(1);
    const metrics = collector.getMetrics();
    expect(metrics[0].value).toBe(2);
  });

  it('should set gauge metrics', () => {
    collector.gauge('gauge', 100, { env: 'test' });
    collector.gauge('gauge', 200, { env: 'test' });
    expect(collector.size()).toBe(1);
    const metrics = collector.getMetrics();
    expect(metrics[0].value).toBe(200);
  });

  it('should get metrics by name', () => {
    collector.record('metric_a', 1);
    collector.record('metric_b', 2);
    collector.record('metric_a', 3);
    const metrics = collector.getMetricsByName('metric_a');
    expect(metrics).toHaveLength(2);
  });

  it('should get summary', () => {
    collector.record('metric', 10);
    collector.record('metric', 20);
    collector.record('metric', 30);
    const summary = collector.getSummary('metric');
    expect(summary).toBeDefined();
    expect(summary?.count).toBe(3);
    expect(summary?.sum).toBe(60);
    expect(summary?.min).toBe(10);
    expect(summary?.max).toBe(30);
    expect(summary?.avg).toBe(20);
  });

  it('should return null for non-existent summary', () => {
    const summary = collector.getSummary('non_existent');
    expect(summary).toBeNull();
  });

  it('should export Prometheus format', () => {
    collector.record('test', 42, { env: 'test' });
    const prometheus = collector.exportPrometheusFormat();
    expect(prometheus).toContain('agi_os_test');
    expect(prometheus).toContain('42');
  });

  it('should clear metrics', () => {
    collector.record('test', 1);
    collector.clear();
    expect(collector.size()).toBe(0);
  });

  it('should respect max metrics limit', () => {
    const limitedCollector = new MetricsCollector(5);
    for (let i = 0; i < 10; i++) {
      limitedCollector.record('test', i);
    }
    expect(limitedCollector.size()).toBe(5);
  });
});

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  it('should create with default config', () => {
    expect(tracker).toBeDefined();
    expect(tracker.size()).toBe(0);
  });

  it('should track token usage', () => {
    const usage = tracker.track({
      provider: 'ollama',
      model: 'llama3.2:3b',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 500,
    });
    expect(usage.requestId).toBeDefined();
    expect(usage.timestamp).toBeDefined();
    expect(tracker.size()).toBe(1);
  });

  it('should get usages by provider', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.track({ provider: 'gemini', model: 'gemini-pro', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 1000 });
    const ollamaUsages = tracker.getUsagesByProvider('ollama');
    expect(ollamaUsages).toHaveLength(1);
  });

  it('should get usages by model', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.track({ provider: 'ollama', model: 'llama3.2:7b', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 1000 });
    const modelUsages = tracker.getUsagesByModel('llama3.2:3b');
    expect(modelUsages).toHaveLength(1);
  });

  it('should get summary', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 1000 });
    const summary = tracker.getSummary('ollama');
    expect(summary).toBeDefined();
    expect(summary?.totalRequests).toBe(2);
    expect(summary?.totalTokens).toBe(450);
    expect(summary?.avgLatencyMs).toBe(750);
  });

  it('should get total tokens', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 1000 });
    expect(tracker.getTotalTokens()).toBe(450);
  });

  it('should get average latency', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 1000 });
    expect(tracker.getAverageLatency()).toBe(750);
  });

  it('should clear usages', () => {
    tracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    tracker.clear();
    expect(tracker.size()).toBe(0);
  });
});

describe('PrometheusExporter', () => {
  let metricsCollector: MetricsCollector;
  let tokenTracker: TokenTracker;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    tokenTracker = new TokenTracker();
    exporter = new PrometheusExporter(metricsCollector, tokenTracker);
  });

  it('should create with config', () => {
    expect(exporter).toBeDefined();
  });

  it('should export metrics', () => {
    metricsCollector.record('test', 42, { env: 'test' });
    const output = exporter.export();
    expect(output).toContain('agi_os_test');
    expect(output).toContain('42');
  });

  it('should export token metrics', () => {
    tokenTracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
    const output = exporter.export();
    expect(output).toContain('agi_os_token_total');
    expect(output).toContain('agi_os_request_total');
  });

  it('should export system health metrics', () => {
    const output = exporter.export();
    expect(output).toContain('agi_os_uptime_seconds');
    expect(output).toContain('agi_os_memory_usage_bytes');
  });

  it('should get content type', () => {
    expect(exporter.getContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
  });

  it('should use custom prefix', () => {
    const customExporter = new PrometheusExporter(metricsCollector, tokenTracker, { prefix: 'custom' });
    metricsCollector.record('test', 42);
    const output = customExporter.export();
    expect(output).toContain('custom_test');
  });
});

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  it('should create with default config', () => {
    expect(logger).toBeDefined();
    expect(logger.size()).toBe(0);
  });

  it('should log events', () => {
    logger.log({
      type: 'governance',
      action: 'approve',
      actor: 'agent-1',
      target: 'mission-1',
      result: 'success',
      metadata: {},
    });
    expect(logger.size()).toBe(1);
  });

  it('should log governance events', () => {
    logger.logGovernance('approve', 'agent-1', 'mission-1', 'success');
    const events = logger.getEventsByType('governance');
    expect(events).toHaveLength(1);
  });

  it('should log tool events', () => {
    logger.logTool('execute', 'agent-1', 'tool-1', 'success');
    const events = logger.getEventsByType('tool');
    expect(events).toHaveLength(1);
  });

  it('should log mission events', () => {
    logger.logMission('start', 'agent-1', 'mission-1', 'success');
    const events = logger.getEventsByType('mission');
    expect(events).toHaveLength(1);
  });

  it('should log security events', () => {
    logger.logSecurity('block', 'system', 'cloud-provider', 'denied');
    const events = logger.getEventsByType('security');
    expect(events).toHaveLength(1);
  });

  it('should log system events', () => {
    logger.logSystem('startup', 'system', 'success');
    const events = logger.getEventsByType('system');
    expect(events).toHaveLength(1);
  });

  it('should query events', () => {
    logger.logGovernance('approve', 'agent-1', 'mission-1', 'success');
    logger.logGovernance('deny', 'agent-1', 'mission-2', 'denied');
    logger.logTool('execute', 'agent-2', 'tool-1', 'success');

    const governanceEvents = logger.query({ type: 'governance' });
    expect(governanceEvents).toHaveLength(2);

    const deniedEvents = logger.query({ result: 'denied' });
    expect(deniedEvents).toHaveLength(1);

    const agent1Events = logger.query({ actor: 'agent-1' });
    expect(agent1Events).toHaveLength(2);
  });

  it('should get events by result', () => {
    logger.logGovernance('approve', 'agent-1', 'mission-1', 'success');
    logger.logGovernance('deny', 'agent-1', 'mission-2', 'denied');
    const successEvents = logger.getEventsByResult('success');
    expect(successEvents).toHaveLength(1);
  });

  it('should clear events', () => {
    logger.logGovernance('approve', 'agent-1', 'mission-1', 'success');
    logger.clear();
    expect(logger.size()).toBe(0);
  });

  it('should respect max events limit', () => {
    const limitedLogger = new AuditLogger(5);
    for (let i = 0; i < 10; i++) {
      limitedLogger.logGovernance('approve', 'agent-1', `mission-${i}`, 'success');
    }
    expect(limitedLogger.size()).toBe(5);
  });
});
