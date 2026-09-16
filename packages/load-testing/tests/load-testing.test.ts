import { describe, it, expect } from 'vitest';
import { LoadTester, LoadTestConfig, StressTestConfig } from '../src/index.js';

describe('LoadTester', () => {
  it('should create with default config', () => {
    const tester = new LoadTester();
    const config = tester.getConfig();
    expect(config.concurrency).toBe(10);
    expect(config.duration_seconds).toBe(60);
    expect(config.ramp_up_seconds).toBe(10);
    expect(config.target_rps).toBe(100);
  });

  it('should create with custom config', () => {
    const tester = new LoadTester({
      concurrency: 20,
      duration_seconds: 30,
      ramp_up_seconds: 5,
      target_rps: 200,
    });
    const config = tester.getConfig();
    expect(config.concurrency).toBe(20);
    expect(config.duration_seconds).toBe(30);
    expect(config.ramp_up_seconds).toBe(5);
    expect(config.target_rps).toBe(200);
  });

  it('should run simple load test', async () => {
    const tester = new LoadTester({
      concurrency: 2,
      duration_seconds: 2,
      ramp_up_seconds: 1,
      target_rps: 10,
    });

    let callCount = 0;
    const result = await tester.runLoadTest(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.total_requests).toBeGreaterThan(0);
    expect(result.successful_requests).toBeGreaterThan(0);
    expect(result.avg_latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.requests_per_second).toBeGreaterThan(0);
  });

  it('should track errors in load test', async () => {
    const tester = new LoadTester({
      concurrency: 2,
      duration_seconds: 1,
      ramp_up_seconds: 0,
      target_rps: 10,
    });

    let callCount = 0;
    const result = await tester.runLoadTest(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        throw new Error('test error');
      }
    });

    expect(result.failed_requests).toBeGreaterThan(0);
    expect(result.errors['test error']).toBeGreaterThan(0);
  });

  it('should calculate latency percentiles', async () => {
    const tester = new LoadTester({
      concurrency: 1,
      duration_seconds: 1,
      ramp_up_seconds: 0,
      target_rps: 10,
    });

    const result = await tester.runLoadTest(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    });

    expect(result.p50_latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.p95_latency_ms).toBeGreaterThanOrEqual(result.p50_latency_ms);
    expect(result.p99_latency_ms).toBeGreaterThanOrEqual(result.p95_latency_ms);
    expect(result.max_latency_ms).toBeGreaterThanOrEqual(result.p99_latency_ms);
  });

  it('should run stress test', async () => {
    const tester = new LoadTester({
      concurrency: 10,
      duration_seconds: 60,
    });

    const result = await tester.runStressTest(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      },
      {
        start_concurrency: 1,
        max_concurrency: 5,
        step_duration_seconds: 1,
        step_concurrency_increase: 2,
      }
    );

    expect(result.breaking_point).toBeGreaterThan(0);
    expect(result.max_sustainable_rps).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('should identify breaking point', async () => {
    const tester = new LoadTester({
      concurrency: 10,
      duration_seconds: 10,
    });

    let callCount = 0;
    const result = await tester.runStressTest(
      async () => {
        callCount++;
        if (callCount > 20) {
          throw new Error('Service overloaded');
        }
        await new Promise(resolve => setTimeout(resolve, 5));
      },
      {
        start_concurrency: 1,
        max_concurrency: 5,
        step_duration_seconds: 1,
        step_concurrency_increase: 2,
      }
    );

    expect(result.breaking_point).toBeLessThanOrEqual(5);
  });

  it('should track RPS per step in stress test', async () => {
    const tester = new LoadTester({
      concurrency: 10,
      duration_seconds: 60,
    });

    const result = await tester.runStressTest(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      },
      {
        start_concurrency: 1,
        max_concurrency: 5,
        step_duration_seconds: 1,
        step_concurrency_increase: 2,
      }
    );

    for (const step of result.steps) {
      expect(step.concurrency).toBeGreaterThan(0);
      expect(step.rps).toBeGreaterThanOrEqual(0);
      expect(step.avg_latency_ms).toBeGreaterThanOrEqual(0);
      expect(step.error_rate).toBeGreaterThanOrEqual(0);
      expect(step.error_rate).toBeLessThanOrEqual(1);
    }
  });
});
