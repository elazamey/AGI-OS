// ============================================================================
// AGI OS - Self-Model Types
// System knows itself: capabilities, limitations, confidence, reliability
// ============================================================================

// ---------------------------------------------------------------------------
// Tool Capability
// ---------------------------------------------------------------------------
export interface ToolCapability {
  toolId: string;
  category: string;
  description: string;
  successRate: number;       // 0-1
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  avgLatencyMs: number;
  lastUsedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  errorTypes: Record<string, number>; // errorType → count
}

// ---------------------------------------------------------------------------
// Provider Capability
// ---------------------------------------------------------------------------
export interface ProviderCapability {
  providerId: string;
  type: 'local' | 'cloud-free' | 'cloud-paid';
  model: string;
  successRate: number;       // 0-1
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  avgLatencyMs: number;
  avgTokensPerSecond: number;
  lastUsedAt: string;
  costPerToken: number;      // must be 0 for our system
  rateLimitRpm: number | null;
  rateLimitTPM: number | null;
  currentQuotaUsed: number;
  currentQuotaLimit: number | null;
}

// ---------------------------------------------------------------------------
// Limitation
// ---------------------------------------------------------------------------
export type LimitationSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface Limitation {
  id: string;
  category: 'tool' | 'provider' | 'domain' | 'resource' | 'knowledge' | 'temporal';
  description: string;
  severity: LimitationSeverity;
  discoveredAt: string;
  lastHitAt: string;
  hitCount: number;
  workaround: string | null;
  autoDetected: boolean;
  evidenceRefs: string[];
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------
export interface DomainConfidence {
  domain: string;
  score: number;             // 0-1
  sampleSize: number;
  lastUpdated: string;
  trend: 'improving' | 'stable' | 'declining';
  history: ConfidenceSample[];
}

export interface ConfidenceSample {
  score: number;
  timestamp: string;
  missionId: string;
}

// ---------------------------------------------------------------------------
// Reliability
// ---------------------------------------------------------------------------
export interface ReliabilityRecord {
  componentId: string;
  componentType: 'tool' | 'provider' | 'module';
  successRate: number;       // 0-1
  mtbf: number;              // mean time between failures (ms)
  mttr: number;              // mean time to repair (ms)
  lastFailureAt: string | null;
  lastRecoveryAt: string | null;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalUptimeMs: number;
  totalDowntimeMs: number;
  failureHistory: FailureEvent[];
}

export interface FailureEvent {
  timestamp: string;
  errorType: string;
  errorMessage: string;
  recovered: boolean;
  recoveryTimeMs: number | null;
}

// ---------------------------------------------------------------------------
// Failure Pattern
// ---------------------------------------------------------------------------
export type PatternFrequency = 'rare' | 'occasional' | 'frequent' | 'systemic';

export interface FailurePattern {
  id: string;
  name: string;
  description: string;
  signatures: PatternSignature[];
  frequency: PatternFrequency;
  impact: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  affectedComponents: string[];
  suggestedMitigation: string;
  autoDetected: boolean;
  evidenceRefs: string[];
}

export interface PatternSignature {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | number;
}

// ---------------------------------------------------------------------------
// Self-Model Snapshot
// ---------------------------------------------------------------------------
export interface SelfModelSnapshot {
  timestamp: string;
  toolCapabilities: ToolCapability[];
  providerCapabilities: ProviderCapability[];
  limitations: Limitation[];
  domainConfidence: DomainConfidence[];
  reliabilityRecords: ReliabilityRecord[];
  failurePatterns: FailurePattern[];
  overallHealth: number;     // 0-1
  knownCapabilityCount: number;
  knownLimitationCount: number;
  knownPatternCount: number;
}

// ---------------------------------------------------------------------------
// Self-Model Update Event
// ---------------------------------------------------------------------------
export type UpdateEventType =
  | 'tool_used'
  | 'tool_succeeded'
  | 'tool_failed'
  | 'provider_used'
  | 'provider_succeeded'
  | 'provider_failed'
  | 'limitation_hit'
  | 'limitation_discovered'
  | 'pattern_detected'
  | 'mission_completed'
  | 'mission_failed';

export interface SelfModelUpdateEvent {
  type: UpdateEventType;
  componentId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
