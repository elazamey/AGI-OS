// ============================================================================
// AGI OS - Semantic Vector Memory
// RAG-ready semantic search via local cosine similarity — $0 cost
// ============================================================================

import { LocalVectorEngine } from './vector/vector-engine.js';
import type { VectorSearchResult } from './vector/types.js';

// ---------------------------------------------------------------------------
// SemanticVectorMemory — semantic search over lessons and facts
// ---------------------------------------------------------------------------
export class SemanticVectorMemory {
  private engine: LocalVectorEngine;

  constructor(dimension: number = 64) {
    this.engine = new LocalVectorEngine({ dimension });
  }

  /**
   * Store a lesson/fact for semantic retrieval
   */
  store(id: string, text: string, metadata?: Record<string, unknown>): void {
    this.engine.insertWithId(id, text, metadata);
  }

  /**
   * Search for semantically similar content
   */
  search(query: string, topK: number = 5): VectorSearchResult[] {
    return this.engine.search(query, topK);
  }

  /**
   * Find the most relevant stored item for a query
   */
  findMostRelevant(query: string): VectorSearchResult | null {
    const results = this.engine.search(query, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get stored document count
   */
  count(): number {
    return this.engine.count();
  }

  /**
   * Clear all stored content
   */
  clear(): void {
    this.engine.clear();
  }

  /**
   * Get underlying engine (for advanced use)
   */
  getEngine(): LocalVectorEngine {
    return this.engine;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createSemanticVectorMemory(dimension?: number): SemanticVectorMemory {
  return new SemanticVectorMemory(dimension);
}
