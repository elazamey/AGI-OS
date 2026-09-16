// ═══════════════════════════════════════════════════════
// Capability Types & Interfaces
// ═══════════════════════════════════════════════════════

export type CapabilityType = 'package' | 'mcp_service' | 'http_api';
export type CapabilityCategory = 'cognition' | 'governance' | 'devops' | 'memory' | 'connector';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CapabilityStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface RepositoryCapability {
  id: string;
  repoName: string;
  type: CapabilityType;
  category: CapabilityCategory;
  endpoint?: string;
  providedSkills: string[];
  healthCheckUrl?: string;
  policyRequirements: {
    requiresApproval: boolean;
    riskLevel: RiskLevel;
  };
  status: CapabilityStatus;
  registeredAt?: number;
  lastHealthCheck?: number;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  capabilityId: string;
  status: CapabilityStatus;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

export interface MCPManifest {
  name: string;
  version: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  endpoint: string;
}
