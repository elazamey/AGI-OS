// ═══════════════════════════════════════════════════════
// Benchmark Scorecard — Captured from arena-eval run
// ═══════════════════════════════════════════════════════

export interface BenchmarkScorecard {
  timestamp: string;
  version: string;
  overallScore: number;
  scores: {
    redTeamBlockRate: number;
    governanceBypassRate: number;
    selfHealingSuccess: number;
    tokenEfficiencyRatio: number;
  };
  redTeam: {
    blockRate: number;
    blocked: number;
    totalScenarios: number;
    categoryBreakdown: Record<string, { total: number; blocked: number }>;
  };
  governance: {
    bypassRate: number;
    totalScenarios: number;
    correctlyHandled: number;
    riskDistribution: Record<string, number>;
  };
  selfHealing: {
    successRate: number;
    totalScenarios: number;
    recovered: number;
    degraded: number;
    failed: number;
    averageRetries: number;
  };
  tokenEfficiency: {
    score: number;
    totalTasks: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  competitiveRanking: Array<{
    framework: string;
    type: string;
    governanceScore: number;
    securityScore: number;
    efficiencyScore: number;
    capabilityScore: number;
    overallScore: number;
  }>;
}

export const LATEST_SCORECARD: BenchmarkScorecard = {
  timestamp: '2026-09-14T11:30:34.963Z',
  version: 'v1.30.0',
  overallScore: 90.08,
  scores: {
    redTeamBlockRate: 88.89,
    governanceBypassRate: 0,
    selfHealingSuccess: 75,
    tokenEfficiencyRatio: 97.79,
  },
  redTeam: {
    blockRate: 88.89,
    blocked: 16,
    totalScenarios: 18,
    categoryBreakdown: {
      prompt_injection: { total: 5, blocked: 4 },
      role_hijack: { total: 3, blocked: 3 },
      data_exfil: { total: 3, blocked: 3 },
      boundary_escape: { total: 3, blocked: 3 },
      tool_abuse: { total: 4, blocked: 3 },
    },
  },
  governance: {
    bypassRate: 0,
    totalScenarios: 12,
    correctlyHandled: 12,
    riskDistribution: { CRITICAL: 5, SENSITIVE: 3, SAFE: 4 },
  },
  selfHealing: {
    successRate: 75,
    totalScenarios: 8,
    recovered: 6,
    degraded: 0,
    failed: 2,
    averageRetries: 0.9,
  },
  tokenEfficiency: {
    score: 97.79,
    totalTasks: 9,
    totalTokens: 2476,
    totalCostUsd: 0.002476,
  },
  competitiveRanking: [
    { framework: 'AGI-OS', type: 'open_source', governanceScore: 100, securityScore: 100, efficiencyScore: 90, capabilityScore: 100, overallScore: 98 },
    { framework: 'OpenAI Assistants', type: 'commercial', governanceScore: 60, securityScore: 30, efficiencyScore: 84, capabilityScore: 50, overallScore: 53.8 },
    { framework: 'Claude (Anthropic)', type: 'commercial', governanceScore: 60, securityScore: 30, efficiencyScore: 80, capabilityScore: 50, overallScore: 53 },
    { framework: 'AutoGPT', type: 'open_source', governanceScore: 10, securityScore: 30, efficiencyScore: 40, capabilityScore: 50, overallScore: 30 },
    { framework: 'LangChain', type: 'open_source', governanceScore: 10, securityScore: 0, efficiencyScore: 70, capabilityScore: 25, overallScore: 22 },
    { framework: 'CrewAI', type: 'open_source', governanceScore: 10, securityScore: 0, efficiencyScore: 60, capabilityScore: 25, overallScore: 20 },
  ],
};
