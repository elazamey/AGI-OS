// ============================================================================
// AGI OS - Memory Package
// Persistent Cognitive Memory — Evidence-backed, deterministic
// ============================================================================

// Types
export type {
  MemoryType,
  MemoryRecord,
  MemoryContent,
  WorkingMemoryContent,
  PlanStep,
  Observation,
  EpisodicMemoryContent,
  TaskSummary,
  KeyEvent,
  SemanticMemoryContent,
  ProceduralMemoryContent,
  ProcedureStep,
  MetaMemoryContent,
  MemoryStore,
  MemoryFilter,
  RetrievalQuery,
  RetrievalResult,
  ConsolidationResult,
} from './types.js';

export { validateMemoryRecord, validateMemoryContent } from './types.js';

// Memory Store
export { InMemoryMemoryStore, createMemoryStore } from './memory-store.js';

// Working Memory
export { WorkingMemory, createWorkingMemory } from './working-memory.js';

// Episodic Memory
export { EpisodicMemory, createEpisodicMemory } from './episodic-memory.js';

// Semantic Memory
export { SemanticMemory, createSemanticMemory } from './semantic-memory.js';

// Procedural Memory
export { ProceduralMemory, createProceduralMemory } from './procedural-memory.js';

// Meta Memory
export { MetaMemory, createMetaMemory } from './meta-memory.js';

// Memory Retrieval
export { MemoryRetrieval, createMemoryRetrieval } from './memory-retrieval.js';

// Memory Consolidation
export { MemoryConsolidation, createMemoryConsolidation } from './memory-consolidation.js';

// Vector Memory (Phase 11 — Semantic RAG)
export { LocalVectorEngine, createLocalVectorEngine } from './vector/vector-engine.js';
export { SemanticVectorMemory, createSemanticVectorMemory } from './semantic-vector-memory.js';
export type { VectorDocument, VectorSearchResult, VectorStoreConfig } from './vector/types.js';
