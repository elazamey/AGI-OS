// ============================================================================
// AGI OS - Generalization Types
// Cross-domain testing harness types
// ============================================================================

import type { ActionIntent, PolicyDecision } from '@agi-os/governance';
import type { RiskAssessment } from '@agi-os/governance';

// ---------------------------------------------------------------------------
// Operational Domains
// ---------------------------------------------------------------------------
export enum OperationalDomain {
  SOFTWARE_ENGINEERING = 'SOFTWARE_ENGINEERING',
  SYSTEM_ADMINISTRATION = 'SYSTEM_ADMINISTRATION',
  DATABASE_MANAGEMENT = 'DATABASE_MANAGEMENT',
  E_COMMERCE = 'E_COMMERCE',
  MEDIA_AUTOMATION = 'MEDIA_AUTOMATION',
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  SECURITY_TESTING = 'SECURITY_TESTING',
}

// ---------------------------------------------------------------------------
// Domain Scenario — a single test vector
// ---------------------------------------------------------------------------
export interface DomainScenario {
  id: string;
  domain: OperationalDomain;
  description: string;
  prompt: string;
  actionIntents: ActionIntent[];
  expectedRiskLevel: number;         // RiskLevel enum value (1-4)
  expectedActionModules: string[];   // e.g., ['fs', 'db']
  expectedDecision: PolicyDecision;  // what governance should decide
  tags: string[];
}

// ---------------------------------------------------------------------------
// Scenario Result
// ---------------------------------------------------------------------------
export interface ScenarioResult {
  scenarioId: string;
  domain: OperationalDomain;
  passed: boolean;
  actualDecision: PolicyDecision;
  expectedDecision: PolicyDecision;
  actualRiskLevel: number;
  expectedRiskLevel: number;
  interceptResults: InterceptResult[];
  durationMs: number;
}

export interface InterceptResult {
  intent: ActionIntent;
  decision: PolicyDecision;
  riskAssessment: RiskAssessment;
  matchedRuleId: string | null;
  overridden: boolean;
}

// ---------------------------------------------------------------------------
// Evaluation Report
// ---------------------------------------------------------------------------
export interface EvaluationReport {
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;                // 0-1
  domainResults: DomainEvaluation[];
  durationMs: number;
  timestamp: string;
}

export interface DomainEvaluation {
  domain: OperationalDomain;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: ScenarioResult[];
}

// ---------------------------------------------------------------------------
// Evaluation Config
// ---------------------------------------------------------------------------
export interface EvaluationConfig {
  failOnFirst: boolean;            // stop on first failure
  verbose: boolean;                // log detailed results
  filterDomains?: OperationalDomain[]; // only run these domains
  filterTags?: string[];           // only run scenarios with these tags
}
