// ============================================================================
// AGI OS - Memory Types
// Evidence-backed persistent cognitive memory
// ============================================================================

// ---------------------------------------------------------------------------
// Memory Types
// ---------------------------------------------------------------------------
export type MemoryType =
  | 'working'      // Current goal, plan, active observations
  | 'episodic'     // Missions, actions, failures, outcomes
  | 'semantic'     // Facts, concepts, relationships
  | 'procedural'   // Skills, workflows, successful strategies
  | 'meta';        // Confidence, capability reliability, failure patterns

// ---------------------------------------------------------------------------
// Memory Record — atomic unit of memory
// ---------------------------------------------------------------------------
export interface MemoryRecord {
  id: string;
  type: MemoryType;
  content: MemoryContent;
  sourceEventIds: string[];
  evidenceRefs: string[];
  confidence: number;          // 0.0 — 1.0
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Memory Content — type-specific payload
// ---------------------------------------------------------------------------
export type MemoryContent =
  | WorkingMemoryContent
  | EpisodicMemoryContent
  | SemanticMemoryContent
  | ProceduralMemoryContent
  | MetaMemoryContent;

export interface WorkingMemoryContent {
  kind: 'working';
  currentGoal: string | null;
  currentPlan: PlanStep[];
  activeObservations: Observation[];
  scratchpad: Record<string, unknown>;
}

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  dependsOn: string[];
}

export interface Observation {
  id: string;
  source: string;
  content: unknown;
  confidence: number;
  timestamp: string;
}

export interface EpisodicMemoryContent {
  kind: 'episodic';
  missionId: string;
  missionGoal: string;
  outcome: 'success' | 'failure' | 'partial' | 'cancelled';
  duration: number;
  taskSummaries: TaskSummary[];
  keyEvents: KeyEvent[];
  lessonsLearned: string[];
}

export interface TaskSummary {
  taskId: string;
  name: string;
  outcome: 'success' | 'failure' | 'skipped';
  duration: number;
}

export interface KeyEvent {
  type: string;
  timestamp: string;
  description: string;
}

export interface SemanticMemoryContent {
  kind: 'semantic';
  category: 'fact' | 'concept' | 'relationship' | 'definition';
  subject: string;
  predicate: string;
  object: string;
  source: string;
  strength: number;           // 0.0 — 1.0, reinforced by repetition
}

export interface ProceduralMemoryContent {
  kind: 'procedural';
  skill: string;
  description: string;
  steps: ProcedureStep[];
  successCount: number;
  failureCount: number;
  avgDuration: number;
  lastUsedAt: string;
}

export interface ProcedureStep {
  order: number;
  action: string;
  toolId?: string;
  inputPattern?: Record<string, unknown>;
  expectedOutcome?: string;
}

export interface MetaMemoryContent {
  kind: 'meta';
  category: 'confidence' | 'reliability' | 'failure_pattern' | 'capability_assessment';
  subject: string;
  metric: string;
  value: number;
  sampleSize: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ---------------------------------------------------------------------------
// Memory Store Interface
// ---------------------------------------------------------------------------
export interface MemoryStore {
  save(record: MemoryRecord): Promise<void>;
  get(id: string): Promise<MemoryRecord | null>;
  list(filter?: MemoryFilter): Promise<MemoryRecord[]>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
  count(filter?: MemoryFilter): Promise<number>;
}

export interface MemoryFilter {
  type?: MemoryType;
  minConfidence?: number;
  maxConfidence?: number;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Memory Retrieval
// ---------------------------------------------------------------------------
export interface RetrievalQuery {
  text?: string;
  type?: MemoryType;
  missionId?: string;
  minConfidence?: number;
  limit: number;
  includeEvidence: boolean;
}

export interface RetrievalResult {
  record: MemoryRecord;
  score: number;              // relevance score 0.0 — 1.0
  matchedBy: string;          // which field/filter matched
}

// ---------------------------------------------------------------------------
// Memory Consolidation
// ---------------------------------------------------------------------------
export interface ConsolidationResult {
  promoted: string[];         // IDs of promoted records
  reinforced: string[];       // IDs of reinforced records
  decayed: string[];          // IDs of decayed records
  merged: string[];           // IDs of merged records
  removed: string[];          // IDs of removed (stale) records
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
export function validateMemoryRecord(record: unknown): record is MemoryRecord {
  if (typeof record !== 'object' || record === null) return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.type === 'string' &&
    ['working', 'episodic', 'semantic', 'procedural', 'meta'].includes(r.type as string) &&
    typeof r.content === 'object' &&
    r.content !== null &&
    Array.isArray(r.sourceEventIds) &&
    Array.isArray(r.evidenceRefs) &&
    typeof r.confidence === 'number' &&
    r.confidence >= 0 &&
    r.confidence <= 1 &&
    typeof r.createdAt === 'string'
  );
}

export function validateMemoryContent(type: MemoryType, content: unknown): boolean {
  if (typeof content !== 'object' || content === null) return false;
  const c = content as Record<string, unknown>;
  switch (type) {
    case 'working':
      return c.kind === 'working' && Array.isArray(c.currentPlan) && Array.isArray(c.activeObservations);
    case 'episodic':
      return c.kind === 'episodic' && typeof c.missionId === 'string' && typeof c.outcome === 'string';
    case 'semantic':
      return c.kind === 'semantic' && typeof c.subject === 'string' && typeof c.predicate === 'string';
    case 'procedural':
      return c.kind === 'procedural' && typeof c.skill === 'string' && Array.isArray(c.steps);
    case 'meta':
      return c.kind === 'meta' && typeof c.subject === 'string' && typeof c.value === 'number';
    default:
      return false;
  }
}
