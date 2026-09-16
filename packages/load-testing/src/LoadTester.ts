export interface LoadTestConfig {
  concurrency: number;
  duration_seconds: number;
  ramp_up_seconds: number;
  target_rps: number;
}

export interface LoadTestResult {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  max_latency_ms: number;
  requests_per_second: number;
  errors: Record<string, number>;
  duration_ms: number;
}

export interface StressTestConfig {
  start_concurrency: number;
  max_concurrency: number;
  step_duration_seconds: number;
  step_concurrency_increase: number;
}

export interface StressTestResult {
  breaking_point: number;
  max_sustainable_rps: number;
  degradation_start: number;
  steps: Array<{
    concurrency: number;
    rps: number;
    avg_latency_ms: number;
    error_rate: number;
  }>;
}

export class LoadTester {
  private config: LoadTestConfig;

  constructor(config: Partial<LoadTestConfig> = {}) {
    this.config = {
      concurrency: config.concurrency || 10,
      duration_seconds: config.duration_seconds || 60,
      ramp_up_seconds: config.ramp_up_seconds || 10,
      target_rps: config.target_rps || 100,
    };
  }

  async runLoadTest(
    testFn: () => Promise<unknown>
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const latencies: number[] = [];
    const errors: Record<string, number> = {};
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const endTime = startTime + this.config.duration_seconds * 1000;
    const rampUpEnd = startTime + this.config.ramp_up_seconds * 1000;

    while (Date.now() < endTime) {
      const now = Date.now();
      const progress = now < rampUpEnd
        ? (now - startTime) / (rampUpEnd - startTime)
        : 1;
      const currentConcurrency = Math.ceil(this.config.concurrency * progress);

      const promises: Promise<void>[] = [];
      for (let i = 0; i < currentConcurrency; i++) {
        promises.push(
          (async () => {
            const reqStart = Date.now();
            try {
              await testFn();
              const latency = Date.now() - reqStart;
              latencies.push(latency);
              successfulRequests++;
            } catch (error) {
              const latency = Date.now() - reqStart;
              latencies.push(latency);
              failedRequests++;
              const errorType = error instanceof Error ? error.message : 'unknown';
              errors[errorType] = (errors[errorType] || 0) + 1;
            }
            totalRequests++;
          })()
        );
      }

      await Promise.all(promises);

      const targetInterval = 1000 / this.config.target_rps;
      await this.sleep(Math.max(10, targetInterval));
    }

    const durationMs = Date.now() - startTime;

    return {
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      failed_requests: failedRequests,
      avg_latency_ms: this.average(latencies),
      p50_latency_ms: this.percentile(latencies, 50),
      p95_latency_ms: this.percentile(latencies, 95),
      p99_latency_ms: this.percentile(latencies, 99),
      max_latency_ms: Math.max(...latencies),
      requests_per_second: totalRequests / (durationMs / 1000),
      errors,
      duration_ms: durationMs,
    };
  }

  async runStressTest(
    testFn: () => Promise<unknown>,
    config: Partial<StressTestConfig> = {}
  ): Promise<StressTestResult> {
    const stressConfig: StressTestConfig = {
      start_concurrency: config.start_concurrency || 1,
      max_concurrency: config.max_concurrency || 100,
      step_duration_seconds: config.step_duration_seconds || 30,
      step_concurrency_increase: config.step_concurrency_increase || 10,
    };

    const steps: StressTestResult['steps'] = [];
    let breakingPoint = stressConfig.max_concurrency;
    let maxSustainableRps = 0;
    let degradationStart = stressConfig.max_concurrency;

    for (
      let concurrency = stressConfig.start_concurrency;
      concurrency <= stressConfig.max_concurrency;
      concurrency += stressConfig.step_concurrency_increase
    ) {
      const tempConfig: LoadTestConfig = {
        ...this.config,
        concurrency,
        duration_seconds: stressConfig.step_duration_seconds,
      };

      const tempTester = new LoadTester(tempConfig);
      const result = await tempTester.runLoadTest(testFn);

      const errorRate = result.failed_requests / result.total_requests;
      const rps = result.requests_per_second;

      steps.push({
        concurrency,
        rps,
        avg_latency_ms: result.avg_latency_ms,
        error_rate: errorRate,
      });

      if (rps > maxSustainableRps && errorRate < 0.01) {
        maxSustainableRps = rps;
      }

      if (errorRate > 0.1 && breakingPoint === stressConfig.max_concurrency) {
        breakingPoint = concurrency;
      }

      if (errorRate > 0.05 && degradationStart === stressConfig.max_concurrency) {
        degradationStart = concurrency;
      }
    }

    return {
      breaking_point: breakingPoint,
      max_sustainable_rps: maxSustainableRps,
      degradation_start: degradationStart,
      steps,
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConfig(): LoadTestConfig {
    return { ...this.config };
  }
}
