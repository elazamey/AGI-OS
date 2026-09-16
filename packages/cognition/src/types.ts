// ============================================================================
// AGI OS - Cognition Types
// World Model + Cognitive Planning + Hypothesis Engine
// ============================================================================

// ---------------------------------------------------------------------------
// World State
// ---------------------------------------------------------------------------
export interface WorldState {
  id: string;
  revision: number;
  entities: WorldEntity[];
  relationships: WorldRelationship[];
  constraints: WorldConstraint[];
  beliefs: WorldBelief[];
  observations: WorldObservation[];
  resources: WorldResource[];
  timestamp: string;
}

export interface WorldEntity {
  id: string;
  type: string;
  name: string;
  state: Record<string, unknown>;
  confidence: number;
  lastObservedAt: string;
}

export interface WorldRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface WorldConstraint {
  id: string;
  type: 'capability' | 'resource' | 'policy' | 'temporal' | 'causal';
  description: string;
  formula?: string;
  severity: 'hard' | 'soft';
  enabled: boolean;
}

export interface WorldBelief {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  evidenceRefs: string[];
  lastUpdated: string;
}

export interface WorldObservation {
  id: string;
  source: string;
  content: Record<string, unknown>;
  timestamp: string;
  confidence: number;
}

export interface WorldResource {
  id: string;
  type: string;
  name: string;
  available: boolean;
  capacity: number;
  used: number;
}

// ---------------------------------------------------------------------------
// Cognitive Context
// ---------------------------------------------------------------------------
export interface CognitiveContext {
  goal: string;
  goalId: string;
  worldState: WorldState;
  relevantMemories: ContextMemory[];
  availableCapabilities: string[];
  constraints: WorldConstraint[];
  previousFailures: ContextFailure[];
  missionState: MissionStateSnapshot;
  timestamp: string;
}

export interface ContextMemory {
  id: string;
  type: string;
  content: unknown;
  relevanceScore: number;
}

export interface ContextFailure {
  missionId: string;
  goal: string;
  reason: string;
  timestamp: string;
}

export interface MissionStateSnapshot {
  missionId: string;
  state: string;
  taskCount: number;
  completedTasks: number;
}

// ---------------------------------------------------------------------------
// Hypothesis
// ---------------------------------------------------------------------------
export interface Hypothesis {
  id: string;
  observation: string;
  statement: string;
  confidence: number;
  testable: boolean;
  evidenceRefs: string[];
  suggestedTests: string[];
  category: 'causal' | 'correlational' | 'procedural' | 'structural';
}

export interface HypothesisSet {
  id: string;
  observation: string;
  hypotheses: Hypothesis[];
  generatedAt: string;
  providerId: string;
}

// ---------------------------------------------------------------------------
// Cognitive Plan
// ---------------------------------------------------------------------------
export interface CognitivePlan {
  id: string;
  goalId: string;
  goal: string;
  assumptions: Assumption[];
  steps: PlanStep[];
  expectedOutcome: string;
  predictedSuccess: number;
  predictedRisk: number;
  predictedCost: number;
  requiredCapabilities: string[];
  evidenceRefs: string[];
  sourceMemoryRefs: string[];
  hypothesisRefs: string[];
  generatedAt: string;
  providerId: string;
}

export interface Assumption {
  id: string;
  statement: string;
  confidence: number;
  impactIfWrong: 'low' | 'medium' | 'high' | 'critical';
}

export interface PlanStep {
  id: string;
  order: number;
  action: string;
  toolId?: string;
  inputPattern?: Record<string, unknown>;
  expectedOutcome?: string;
  dependsOn: string[];
  estimatedDuration: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

// ---------------------------------------------------------------------------
// Plan Validation
// ---------------------------------------------------------------------------
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high';
  stepId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  stepId?: string;
}

// ---------------------------------------------------------------------------
// Plan Ranking
// ---------------------------------------------------------------------------
export interface RankedPlan {
  plan: CognitivePlan;
  rank: number;
  score: number;
  breakdown: RankingBreakdown;
}

export interface RankingBreakdown {
  successScore: number;
  riskScore: number;
  costScore: number;
  capabilityScore: number;
  assumptionScore: number;
}

// ---------------------------------------------------------------------------
// Cognitive Decision
// ---------------------------------------------------------------------------
export interface CognitiveDecision {
  id: string;
  goalId: string;
  selectedPlan: CognitivePlan;
  rejectedPlans: RejectedPlan[];
  hypothesisSet: HypothesisSet;
  context: CognitiveContext;
  reason: string;
  decidedAt: string;
}

export interface RejectedPlan {
  plan: CognitivePlan;
  reason: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------
export interface CognitiveProvider {
  readonly id: string;
  readonly name: string;
  generate(input: CognitiveInput): Promise<CognitiveOutput>;
  isAvailable(): Promise<boolean>;
}

export interface CognitiveInput {
  context: CognitiveContext;
  hypothesisSet: HypothesisSet;
  planCount: number;
  constraints: WorldConstraint[];
}

export interface CognitiveOutput {
  plans: CognitivePlan[];
  reasoning: string;
  providerId: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Deterministic Fallback
// ---------------------------------------------------------------------------
export interface DeterministicPlanResult {
  plans: CognitivePlan[];
  source: 'deterministic';
  reason: string;
}
