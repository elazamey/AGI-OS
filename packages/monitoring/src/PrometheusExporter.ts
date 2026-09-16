import type { MetricsCollector, MetricPoint } from './MetricsCollector.js';
import type { TokenTracker } from './TokenTracker.js';

export interface PrometheusConfig {
  prefix?: string;
  includeTimestamp?: boolean;
}

export class PrometheusExporter {
  private metricsCollector: MetricsCollector;
  private tokenTracker: TokenTracker;
  private config: PrometheusConfig;

  constructor(
    metricsCollector: MetricsCollector,
    tokenTracker: TokenTracker,
    config: PrometheusConfig = {}
  ) {
    this.metricsCollector = metricsCollector;
    this.tokenTracker = tokenTracker;
    this.config = {
      prefix: 'agi_os',
      includeTimestamp: true,
      ...config,
    };
  }

  export(): string {
    const lines: string[] = [];

    // Export metrics collector data
    lines.push(this.exportMetrics());

    // Export token usage data
    lines.push(this.exportTokenMetrics());

    // Export system health metrics
    lines.push(this.exportSystemHealth());

    return lines.join('\n');
  }

  private exportMetrics(): string {
    const lines: string[] = [];
    const metrics = this.metricsCollector.getMetrics();
    const grouped = this.groupByMetricName(metrics);

    for (const [name, points] of Object.entries(grouped)) {
      const metricName = `${this.config.prefix}_${name}`;
      lines.push(`# HELP ${metricName} AGI-OS runtime metric`);
      lines.push(`# TYPE ${metricName} gauge`);

      for (const p of points) {
        const labelStr = Object.entries(p.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');

        const timestamp = this.config.includeTimestamp ? ` ${p.timestamp}` : '';
        lines.push(`${metricName}{${labelStr}} ${p.value}${timestamp}`);
      }
    }

    return lines.join('\n');
  }

  private exportTokenMetrics(): string {
    const lines: string[] = [];
    const summary = this.tokenTracker.getSummary();

    if (summary) {
      lines.push(`# HELP ${this.config.prefix}_token_total Total tokens used`);
      lines.push(`# TYPE ${this.config.prefix}_token_total counter`);
      lines.push(`${this.config.prefix}_token_total ${summary.totalTokens}`);

      lines.push(`# HELP ${this.config.prefix}_request_total Total LLM requests`);
      lines.push(`# TYPE ${this.config.prefix}_request_total counter`);
      lines.push(`${this.config.prefix}_request_total ${summary.totalRequests}`);

      lines.push(`# HELP ${this.config.prefix}_latency_ms Average LLM latency`);
      lines.push(`# TYPE ${this.config.prefix}_latency_ms gauge`);
      lines.push(`${this.config.prefix}_latency_ms ${summary.avgLatencyMs}`);
    }

    return lines.join('\n');
  }

  private exportSystemHealth(): string {
    const lines: string[] = [];

    lines.push(`# HELP ${this.config.prefix}_uptime_seconds System uptime`);
    lines.push(`# TYPE ${this.config.prefix}_uptime_seconds gauge`);
    lines.push(`${this.config.prefix}_uptime_seconds ${process.uptime()}`);

    lines.push(`# HELP ${this.config.prefix}_memory_usage_bytes Memory usage`);
    lines.push(`# TYPE ${this.config.prefix}_memory_usage_bytes gauge`);
    lines.push(`${this.config.prefix}_memory_usage_bytes ${process.memoryUsage().heapUsed}`);

    return lines.join('\n');
  }

  private groupByMetricName(metrics: MetricPoint[]): Record<string, MetricPoint[]> {
    return metrics.reduce((acc, point) => {
      if (!acc[point.name]) acc[point.name] = [];
      acc[point.name].push(point);
      return acc;
    }, {} as Record<string, MetricPoint[]>);
  }

  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }
}
