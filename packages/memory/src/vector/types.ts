// ============================================================================
// AGI OS - Vector Memory Types
// Deterministic local cosine similarity — $0 cost
// ============================================================================

export interface VectorDocument {
  id: string;
  text: string;
  vector: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
}

export interface VectorStoreConfig {
  dimension: number;
}
