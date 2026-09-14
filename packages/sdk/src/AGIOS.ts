// ═══════════════════════════════════════════════════════
// AGI-OS SDK — Official TypeScript Client
// ═══════════════════════════════════════════════════════

import { HTTPClient, AGIOSError } from './http';
import {
  AGIOSConfig,
  ExecuteOptions,
  MissionResult,
  Skill,
  HealthStatus,
  ModelInfo,
  MemoryEntry,
} from './types';

export class AGIOS {
  private client: HTTPClient;

  constructor(config: AGIOSConfig) {
    if (!config.baseUrl) {
      throw new Error('AGI-OS SDK: baseUrl is required');
    }

    this.client = new HTTPClient({
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      retries: config.retries ?? 3,
    });
  }

  // ── Agent Methods ──────────────────────────────────────

  async execute(options: ExecuteOptions): Promise<MissionResult> {
    const result = await this.client.post<{ id: string; status: string; approval_required?: boolean }>(
      '/api/v1/missions/execute',
      {
        prompt: options.prompt,
        capabilities: options.capabilities,
        context: options.context,
        webhook_url: options.webhookUrl,
        budget_usd: options.budgetUsd,
        budget_tokens: options.budgetTokens,
      }
    );

    return this.pollMission(result.id);
  }

  async getMission(id: string): Promise<MissionResult> {
    const raw = await this.client.get<{
      id: string;
      status: string;
      result?: unknown;
      events: Array<{ stage: string; event: string; data: Record<string, unknown>; timestamp: number }>;
    }>(`/api/v1/missions/${id}`);

    return {
      id: raw.id,
      status: raw.status,
      output: typeof raw.result === 'string' ? raw.result : JSON.stringify(raw.result),
      governanceAudit: { riskLevel: 'UNKNOWN', requiresApproval: false, approved: true, policyChecks: [] },
      metrics: { tokensUsed: 0, costUsd: 0, latencyMs: 0, retriesAttempted: 0 },
      events: raw.events || [],
    };
  }

  async rollbackMission(id: string): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>(`/api/v1/missions/${id}/rollback`);
  }

  async listMissions(): Promise<MissionResult[]> {
    const raw = await this.client.get<Array<{ id: string; status: string; events: unknown[] }>>('/api/v1/missions');
    return (raw || []).map(m => ({
      id: m.id,
      status: m.status,
      governanceAudit: { riskLevel: 'UNKNOWN', requiresApproval: false, approved: true, policyChecks: [] },
      metrics: { tokensUsed: 0, costUsd: 0, latencyMs: 0, retriesAttempted: 0 },
      events: (m.events || []) as MissionResult['events'],
    }));
  }

  private async pollMission(id: string, maxAttempts = 30): Promise<MissionResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const mission = await this.getMission(id);
      if (['COMPLETED', 'FAILED', 'PENDING_APPROVAL'].includes(mission.status)) {
        return mission;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return this.getMission(id);
  }

  // ── Skills Methods ─────────────────────────────────────

  async listSkills(): Promise<Skill[]> {
    return this.client.get<Skill[]>('/api/v1/skills');
  }

  async synthesizeSkill(description: string): Promise<{ name: string; code: string }> {
    return this.client.post<{ name: string; code: string }>('/api/v1/skills/synthesize', {
      description,
    });
  }

  // ── Memory Methods ─────────────────────────────────────

  async storeMemory(entry: MemoryEntry): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>('/api/v1/memory/store', entry);
  }

  async queryMemory(query: string, namespace?: string): Promise<unknown[]> {
    return this.client.post<unknown[]>('/api/v1/memory/query', { query, namespace });
  }

  // ── System Methods ─────────────────────────────────────

  async health(): Promise<HealthStatus> {
    return this.client.get<HealthStatus>('/health');
  }

  async models(): Promise<ModelInfo[]> {
    const raw = await this.client.get<Array<{ id: string; owned_by: string }>>('/v1/models');
    return raw.map(m => ({ id: m.id, name: m.id, provider: m.owned_by }));
  }

  async selfModel(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>('/api/v1/self-model');
  }

  async metrics(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>('/metrics');
  }

  async ready(): Promise<boolean> {
    try {
      const result = await this.client.get<{ ready: boolean }>('/ready');
      return result.ready;
    } catch {
      return false;
    }
  }
}
