export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CostEntry {
  id: string;
  mission_id: string;
  model: string;
  provider: string;
  phase: 'planning' | 'execution' | 'verification';
  tokens: TokenUsage;
  cost_usd: number;
  latency_ms: number;
  timestamp: number;
}

export interface MissionCost {
  mission_id: string;
  total_cost_usd: number;
  total_tokens: TokenUsage;
  phases: Record<string, CostEntry[]>;
  avg_latency_ms: number;
}

export interface CostReport {
  total_cost_usd: number;
  total_tokens: TokenUsage;
  total_missions: number;
  avg_cost_per_mission: number;
  avg_tokens_per_mission: number;
  cost_by_model: Record<string, { cost: number; tokens: number; count: number }>;
  cost_by_phase: Record<string, { cost: number; tokens: number }>;
  cost_by_provider: Record<string, { cost: number; tokens: number; count: number }>;
  efficiency_score: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private modelPricing: Record<string, { input: number; output: number }> = {
    'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
    'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
    'meta-llama/llama-3.3-70b-instruct:free': { input: 0, output: 0 },
    'llama3.2:3b': { input: 0, output: 0 },
  };

  recordUsage(usage: Omit<CostEntry, 'id' | 'cost_usd' | 'timestamp'>): CostEntry {
    const pricing = this.modelPricing[usage.model] || { input: 0.001, output: 0.001 };
    const cost = (usage.tokens.prompt_tokens * pricing.input) + (usage.tokens.completion_tokens * pricing.output);

    const entry: CostEntry = {
      ...usage,
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cost_usd: cost,
      timestamp: Date.now(),
    };

    this.entries.push(entry);
    return entry;
  }

  getMissionCost(missionId: string): MissionCost {
    const missionEntries = this.entries.filter(e => e.mission_id === missionId);
    const phases: Record<string, CostEntry[]> = {};

    for (const entry of missionEntries) {
      if (!phases[entry.phase]) phases[entry.phase] = [];
      phases[entry.phase].push(entry);
    }

    const totalTokens: TokenUsage = {
      prompt_tokens: missionEntries.reduce((sum, e) => sum + e.tokens.prompt_tokens, 0),
      completion_tokens: missionEntries.reduce((sum, e) => sum + e.tokens.completion_tokens, 0),
      total_tokens: missionEntries.reduce((sum, e) => sum + e.tokens.total_tokens, 0),
    };

    return {
      mission_id: missionId,
      total_cost_usd: missionEntries.reduce((sum, e) => sum + e.cost_usd, 0),
      total_tokens: totalTokens,
      phases,
      avg_latency_ms: missionEntries.length > 0
        ? missionEntries.reduce((sum, e) => sum + e.latency_ms, 0) / missionEntries.length
        : 0,
    };
  }

  getReport(): CostReport {
    const totalTokens: TokenUsage = {
      prompt_tokens: this.entries.reduce((sum, e) => sum + e.tokens.prompt_tokens, 0),
      completion_tokens: this.entries.reduce((sum, e) => sum + e.tokens.completion_tokens, 0),
      total_tokens: this.entries.reduce((sum, e) => sum + e.tokens.total_tokens, 0),
    };

    const totalCost = this.entries.reduce((sum, e) => sum + e.cost_usd, 0);
    const uniqueMissions = new Set(this.entries.map(e => e.mission_id));

    const costByModel: Record<string, { cost: number; tokens: number; count: number }> = {};
    const costByPhase: Record<string, { cost: number; tokens: number }> = {};
    const costByProvider: Record<string, { cost: number; tokens: number; count: number }> = {};

    for (const entry of this.entries) {
      if (!costByModel[entry.model]) {
        costByModel[entry.model] = { cost: 0, tokens: 0, count: 0 };
      }
      costByModel[entry.model].cost += entry.cost_usd;
      costByModel[entry.model].tokens += entry.tokens.total_tokens;
      costByModel[entry.model].count++;

      if (!costByPhase[entry.phase]) {
        costByPhase[entry.phase] = { cost: 0, tokens: 0 };
      }
      costByPhase[entry.phase].cost += entry.cost_usd;
      costByPhase[entry.phase].tokens += entry.tokens.total_tokens;

      if (!costByProvider[entry.provider]) {
        costByProvider[entry.provider] = { cost: 0, tokens: 0, count: 0 };
      }
      costByProvider[entry.provider].cost += entry.cost_usd;
      costByProvider[entry.provider].tokens += entry.tokens.total_tokens;
      costByProvider[entry.provider].count++;
    }

    const planningCost = costByPhase['planning']?.cost || 0;
    const executionCost = costByPhase['execution']?.cost || 0;
    const efficiencyScore = totalCost > 0 ? (executionCost / totalCost) : 0.5;

    return {
      total_cost_usd: totalCost,
      total_tokens: totalTokens,
      total_missions: uniqueMissions.size,
      avg_cost_per_mission: uniqueMissions.size > 0 ? totalCost / uniqueMissions.size : 0,
      avg_tokens_per_mission: uniqueMissions.size > 0 ? totalTokens.total_tokens / uniqueMissions.size : 0,
      cost_by_model: costByModel,
      cost_by_phase: costByPhase,
      cost_by_provider: costByProvider,
      efficiency_score: efficiencyScore,
    };
  }

  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  setModelPricing(model: string, input: number, output: number): void {
    this.modelPricing[model] = { input, output };
  }
}
