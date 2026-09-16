import { generateId } from '@agi-os/kernel';

export interface TokenUsage {
  requestId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  timestamp: number;
}

export interface TokenSummary {
  provider: string;
  model: string;
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
}

export class TokenTracker {
  private usages: TokenUsage[] = [];
  private maxUsages: number;

  constructor(maxUsages: number = 5000) {
    this.maxUsages = maxUsages;
  }

  track(usage: Omit<TokenUsage, 'requestId' | 'timestamp'>): TokenUsage {
    if (this.usages.length >= this.maxUsages) {
      this.usages.shift();
    }

    const fullUsage: TokenUsage = {
      ...usage,
      requestId: generateId(),
      timestamp: Date.now(),
    };

    this.usages.push(fullUsage);
    return fullUsage;
  }

  getUsages(): TokenUsage[] {
    return [...this.usages];
  }

  getUsagesByProvider(provider: string): TokenUsage[] {
    return this.usages.filter(u => u.provider === provider);
  }

  getUsagesByModel(model: string): TokenUsage[] {
    return this.usages.filter(u => u.model === model);
  }

  getSummary(provider?: string, model?: string): TokenSummary | null {
    let filtered = this.usages;

    if (provider) {
      filtered = filtered.filter(u => u.provider === provider);
    }
    if (model) {
      filtered = filtered.filter(u => u.model === model);
    }

    if (filtered.length === 0) return null;

    return {
      provider: provider || 'all',
      model: model || 'all',
      totalRequests: filtered.length,
      totalTokens: filtered.reduce((sum, u) => sum + u.totalTokens, 0),
      avgLatencyMs: filtered.reduce((sum, u) => sum + u.latencyMs, 0) / filtered.length,
      totalPromptTokens: filtered.reduce((sum, u) => sum + u.promptTokens, 0),
      totalCompletionTokens: filtered.reduce((sum, u) => sum + u.completionTokens, 0),
    };
  }

  getTotalTokens(): number {
    return this.usages.reduce((sum, u) => sum + u.totalTokens, 0);
  }

  getAverageLatency(): number {
    if (this.usages.length === 0) return 0;
    return this.usages.reduce((sum, u) => sum + u.latencyMs, 0) / this.usages.length;
  }

  clear(): void {
    this.usages = [];
  }

  size(): number {
    return this.usages.length;
  }
}
