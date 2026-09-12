// ============================================================================
// AGI OS - Capabilities
// Tracks what the system can do: tool & provider performance
// ============================================================================

import { now } from '@agi-os/kernel';
import type { ToolCapability, ProviderCapability } from './types.js';

// ---------------------------------------------------------------------------
// CapabilityTracker — records and queries tool/provider capabilities
// ---------------------------------------------------------------------------
export class CapabilityTracker {
  private tools: Map<string, ToolCapability> = new Map();
  private providers: Map<string, ProviderCapability> = new Map();

  // ---- Tool tracking -----------------------------------------------------

  recordToolUse(toolId: string, success: boolean, latencyMs: number, errorType?: string): void {
    let cap = this.tools.get(toolId);
    const ts = now().toISOString();

    if (!cap) {
      cap = {
        toolId,
        category: 'unknown',
        description: '',
        successRate: 0,
        totalUses: 0,
        successfulUses: 0,
        failedUses: 0,
        avgLatencyMs: 0,
        lastUsedAt: ts,
        lastSuccessAt: null,
        lastFailureAt: null,
        errorTypes: {},
      };
      this.tools.set(toolId, cap);
    }

    cap.totalUses++;
    if (success) {
      cap.successfulUses++;
      cap.lastSuccessAt = ts;
    } else {
      cap.failedUses++;
      cap.lastFailureAt = ts;
      if (errorType) {
        cap.errorTypes[errorType] = (cap.errorTypes[errorType] ?? 0) + 1;
      }
    }
    cap.successRate = cap.totalUses > 0 ? cap.successfulUses / cap.totalUses : 0;
    cap.avgLatencyMs = ((cap.avgLatencyMs * (cap.totalUses - 1)) + latencyMs) / cap.totalUses;
    cap.lastUsedAt = ts;
  }

  setToolMetadata(toolId: string, category: string, description: string): void {
    let cap = this.tools.get(toolId);
    if (!cap) {
      cap = this.createEmptyTool(toolId);
      this.tools.set(toolId, cap);
    }
    cap.category = category;
    cap.description = description;
  }

  getTool(toolId: string): ToolCapability | undefined {
    return this.tools.get(toolId);
  }

  getTools(): ToolCapability[] {
    return [...this.tools.values()];
  }

  getToolsByCategory(category: string): ToolCapability[] {
    return this.getTools().filter((t) => t.category === category);
  }

  getTopTools(n: number): ToolCapability[] {
    return this.getTools()
      .sort((a, b) => b.successRate - a.successRate || b.totalUses - a.totalUses)
      .slice(0, n);
  }

  // ---- Provider tracking -------------------------------------------------

  recordProviderUse(providerId: string, success: boolean, latencyMs: number, tokensPerSecond: number): void {
    let cap = this.providers.get(providerId);
    const ts = now().toISOString();

    if (!cap) {
      cap = {
        providerId,
        type: 'local',
        model: 'unknown',
        successRate: 0,
        totalUses: 0,
        successfulUses: 0,
        failedUses: 0,
        avgLatencyMs: 0,
        avgTokensPerSecond: 0,
        lastUsedAt: ts,
        costPerToken: 0,
        rateLimitRpm: null,
        rateLimitTPM: null,
        currentQuotaUsed: 0,
        currentQuotaLimit: null,
      };
      this.providers.set(providerId, cap);
    }

    cap.totalUses++;
    if (success) {
      cap.successfulUses++;
    } else {
      cap.failedUses++;
    }
    cap.successRate = cap.totalUses > 0 ? cap.successfulUses / cap.totalUses : 0;
    cap.avgLatencyMs = ((cap.avgLatencyMs * (cap.totalUses - 1)) + latencyMs) / cap.totalUses;
    cap.avgTokensPerSecond = ((cap.avgTokensPerSecond * (cap.totalUses - 1)) + tokensPerSecond) / cap.totalUses;
    cap.lastUsedAt = ts;
  }

  setProviderMetadata(providerId: string, meta: Partial<Pick<ProviderCapability, 'type' | 'model' | 'costPerToken' | 'rateLimitRpm' | 'rateLimitTPM' | 'currentQuotaLimit'>>): void {
    let cap = this.providers.get(providerId);
    if (!cap) {
      cap = this.createEmptyProvider(providerId);
      this.providers.set(providerId, cap);
    }
    Object.assign(cap, meta);
  }

  incrementQuota(providerId: string, tokens: number): void {
    const cap = this.providers.get(providerId);
    if (cap) {
      cap.currentQuotaUsed += tokens;
    }
  }

  getProvider(providerId: string): ProviderCapability | undefined {
    return this.providers.get(providerId);
  }

  getProviders(): ProviderCapability[] {
    return [...this.providers.values()];
  }

  getAvailableProviders(): ProviderCapability[] {
    return this.getProviders().filter((p) => {
      if (p.currentQuotaLimit === null) return true;
      return p.currentQuotaUsed < p.currentQuotaLimit;
    });
  }

  // ---- Aggregate ---------------------------------------------------------

  getWorstTools(n: number): ToolCapability[] {
    return this.getTools()
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, n);
  }

  getOverallToolSuccessRate(): number {
    const tools = this.getTools();
    if (tools.length === 0) return 0;
    const total = tools.reduce((s, t) => s + t.totalUses, 0);
    const success = tools.reduce((s, t) => s + t.successfulUses, 0);
    return total > 0 ? success / total : 0;
  }

  reset(): void {
    this.tools.clear();
    this.providers.clear();
  }

  // ---- Private -----------------------------------------------------------

  private createEmptyTool(toolId: string): ToolCapability {
    return {
      toolId,
      category: 'unknown',
      description: '',
      successRate: 0,
      totalUses: 0,
      successfulUses: 0,
      failedUses: 0,
      avgLatencyMs: 0,
      lastUsedAt: now().toISOString(),
      lastSuccessAt: null,
      lastFailureAt: null,
      errorTypes: {},
    };
  }

  private createEmptyProvider(providerId: string): ProviderCapability {
    return {
      providerId,
      type: 'local',
      model: 'unknown',
      successRate: 0,
      totalUses: 0,
      successfulUses: 0,
      failedUses: 0,
      avgLatencyMs: 0,
      avgTokensPerSecond: 0,
      lastUsedAt: now().toISOString(),
      costPerToken: 0,
      rateLimitRpm: null,
      rateLimitTPM: null,
      currentQuotaUsed: 0,
      currentQuotaLimit: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createCapabilityTracker(): CapabilityTracker {
  return new CapabilityTracker();
}
