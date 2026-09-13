
export interface MetricPoint {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface MetricSummary {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export class MetricsCollector {
  private metrics: MetricPoint[] = [];
  private maxMetrics: number;

  constructor(maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics;
  }

  record(name: string, value: number, labels: Record<string, string> = {}): void {
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }

    this.metrics.push({
      name,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  increment(name: string, labels: Record<string, string> = {}): void {
    const existing = this.metrics.find(
      m => m.name === name && JSON.stringify(m.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value += 1;
      existing.timestamp = Date.now();
    } else {
      this.record(name, 1, labels);
    }
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const existing = this.metrics.find(
      m => m.name === name && JSON.stringify(m.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      this.record(name, value, labels);
    }
  }

  getMetrics(): MetricPoint[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): MetricPoint[] {
    return this.metrics.filter(m => m.name === name);
  }

  getSummary(name: string): MetricSummary | null {
    const points = this.getMetricsByName(name);
    if (points.length === 0) return null;

    const values = points.map(p => p.value);
    return {
      name,
      count: points.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / points.length,
    };
  }

  exportPrometheusFormat(): string {
    const lines: string[] = [];
    const grouped = this.groupByMetricName();

    for (const [name, points] of Object.entries(grouped)) {
      lines.push(`# HELP agi_os_${name} AGI-OS runtime metric`);
      lines.push(`# TYPE agi_os_${name} gauge`);
      for (const p of points) {
        const labelStr = Object.entries(p.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`agi_os_${name}{${labelStr}} ${p.value} ${p.timestamp}`);
      }
    }
    return lines.join('\n');
  }

  private groupByMetricName(): Record<string, MetricPoint[]> {
    return this.metrics.reduce((acc, point) => {
      if (!acc[point.name]) acc[point.name] = [];
      acc[point.name].push(point);
      return acc;
    }, {} as Record<string, MetricPoint[]>);
  }

  clear(): void {
    this.metrics = [];
  }

  size(): number {
    return this.metrics.length;
  }
}
