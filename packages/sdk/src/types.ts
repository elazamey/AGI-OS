// ═══════════════════════════════════════════════════════
// @agi-os/sdk — Type Definitions
// ═══════════════════════════════════════════════════════

export interface AGIOSConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface ExecuteOptions {
  prompt: string;
  capabilities?: string[];
  context?: Record<string, unknown>;
  webhookUrl?: string;
  budgetUsd?: number;
  budgetTokens?: number;
}

export interface MissionResult {
  id: string;
  status: string;
  output?: string;
  governanceAudit: GovernanceAudit;
  metrics: MissionMetrics;
  events: MissionEvent[];
}

export interface GovernanceAudit {
  riskLevel: string;
  requiresApproval: boolean;
  approved: boolean;
  policyChecks: PolicyCheck[];
}

export interface PolicyCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface MissionMetrics {
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  retriesAttempted: number;
}

export interface MissionEvent {
  stage: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  riskLevel: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  uptime: number;
  missions: number;
  skills: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export interface MemoryEntry {
  key: string;
  value: unknown;
  namespace?: string;
}

export interface APIError {
  message: string;
  type: string;
  param?: string;
  code?: string;
}
