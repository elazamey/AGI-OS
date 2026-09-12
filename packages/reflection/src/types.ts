// ============================================================================
// AGI OS - Reflection Types
// Expected vs Actual, Root Cause, Evidence-Validated Lessons
// ============================================================================

// ---------------------------------------------------------------------------
// Mission Outcome
// ---------------------------------------------------------------------------
export interface MissionOutcome {
  missionId: string;
  goalId: string;
  goal: string;
  planId: string;
  predictedSuccess: number;
  predictedRisk: number;
  expectedOutcome: string;
  actualOutcome: string;
  success: boolean;
  duration: number;
  evidenceRefs: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Discrepancy
// ---------------------------------------------------------------------------
export type DiscrepancyType = 'outcome' | 'performance' | 'cost' | 'behavior' | 'constraint';

export type DiscrepancySeverity = 'negligible' | 'minor' | 'moderate' | 'major' | 'critical';

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  description: string;
  expected: string;
  actual: string;
  severity: DiscrepancySeverity;
  measurable: boolean;
  magnitude: number; // 0-1, how far off
}

// ---------------------------------------------------------------------------
// Failure Analysis
// ---------------------------------------------------------------------------
export type FailureCategory =
  | 'missing_information'
  | 'incorrect_assumption'
  | 'resource_unavailable'
  | 'constraint_violation'
  | 'tool_failure'
  | 'planning_error'
  | 'execution_error'
  | 'external_dependency'
  | 'unknown';

export interface FailureAnalysis {
  id: string;
  discrepancyId: string;
  category: FailureCategory;
  description: string;
  contributingFactors: string[];
  evidenceRefs: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Root Cause
// ---------------------------------------------------------------------------
export type RootCauseConfidence = 'low' | 'medium' | 'high';

export interface RootCause {
  id: string;
  failureAnalysisId: string;
  cause: string;
  mechanism: string;
  evidenceRefs: string[];
  confidence: RootCauseConfidence;
  reproducible: boolean;
}

// ---------------------------------------------------------------------------
// Candidate Lesson
// ---------------------------------------------------------------------------
export type LessonCategory =
  | 'strategic'
  | 'tactical'
  | 'procedural'
  | 'environmental'
  | 'resource'
  | 'constraint_awareness';

export type LessonImpact = 'low' | 'medium' | 'high' | 'critical';

export interface CandidateLesson {
  id: string;
  rootCauseId: string;
  statement: string;
  category: LessonCategory;
  impact: LessonImpact;
  applicability: string[]; // contexts where this lesson applies
  prerequisites: string[]; // conditions needed for this lesson to be useful
  suggestedAction: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Lesson Validation
// ---------------------------------------------------------------------------
export type ValidationStatus = 'validated' | 'weak' | 'contradicted' | 'insufficient_evidence';

export interface LessonValidation {
  lessonId: string;
  status: ValidationStatus;
  evidenceCount: number;
  contradictingEvidenceCount: number;
  confidence: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Reflection Record
// ---------------------------------------------------------------------------
export interface ReflectionRecord {
  id: string;
  missionId: string;
  goalId: string;

  outcome: MissionOutcome;
  discrepancies: Discrepancy[];
  failureAnalyses: FailureAnalysis[];
  rootCauses: RootCause[];
  candidateLessons: CandidateLesson[];
  validatedLessons: ValidatedLesson[];

  evidenceRefs: string[];
  sourceEventIds: string[];

  confidence: number;
  reflectedAt: string;
}

// ---------------------------------------------------------------------------
// Validated Lesson (ready for memory)
// ---------------------------------------------------------------------------
export interface ValidatedLesson {
  lesson: CandidateLesson;
  validation: LessonValidation;
  memoryType: 'procedural' | 'semantic' | 'episodic';
}

// ---------------------------------------------------------------------------
// Reflection Engine Input
// ---------------------------------------------------------------------------
export interface ReflectionInput {
  missionId: string;
  goalId: string;
  goal: string;
  planId: string;
  predictedSuccess: number;
  predictedRisk: number;
  expectedOutcome: string;
  actualOutcome: string;
  success: boolean;
  duration: number;
  evidenceRefs: string[];
  sourceEventIds: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Reflection Engine Output
// ---------------------------------------------------------------------------
export interface ReflectionOutput {
  reflection: ReflectionRecord;
  lessonsUpdated: number;
  memoryWrites: MemoryWrite[];
}

export interface MemoryWrite {
  memoryType: 'procedural' | 'semantic' | 'episodic';
  content: unknown;
  confidence: number;
  sourceReflectionId: string;
}

// ---------------------------------------------------------------------------
// Lesson Decay & Pruning (Phase 5 Enhancement)
// ---------------------------------------------------------------------------
export type LessonStatus = 'active' | 'deprecated' | 'superseded';

export interface StoredLesson {
  id: string;
  statement: string;
  category: LessonCategory;
  impact: LessonImpact;
  confidence: number;
  evidenceCount: number;
  contradictionCount: number;
  status: LessonStatus;
  createdAt: string;
  lastValidatedAt: string;
  lastContradictedAt: string | null;
  consecutiveContradictions: number;
  ttlMs: number; // time-to-live in milliseconds
  relevanceScore: number; // 0-1, decays over time
}

export interface LessonDecayConfig {
  defaultTtlMs: number; // default TTL for new lessons (default: 30 days)
  decayRate: number; // relevance decay per day (default: 0.01)
  contradictionThreshold: number; // consecutive contradictions before deprecation (default: 3)
  minRelevance: number; // minimum relevance before auto-prune (default: 0.1)
}

export interface PruneResult {
  pruned: StoredLesson[];
  deprecated: StoredLesson[];
  remaining: number;
}

// ---------------------------------------------------------------------------
// Cascading Failure Grouping (Phase 5 Enhancement)
// ---------------------------------------------------------------------------
export interface FailureGroup {
  id: string;
  rootCause: string;
  failureCategory: FailureCategory;
  missionIds: string[];
  timestampRange: { first: string; last: string };
  count: number;
  consolidatedLesson: CandidateLesson;
  severity: DiscrepancySeverity;
}

export interface CascadingFailureConfig {
  timeWindowMs: number; // window to group failures (default: 5 minutes)
  minGroupSize: number; // minimum failures to form a group (default: 2)
}
