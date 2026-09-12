// ============================================================================
// AGI OS - Local Vector Engine
// Deterministic embedding + cosine similarity — zero cost, zero dependencies
// ============================================================================

import type { VectorDocument, VectorSearchResult, VectorStoreConfig } from './types.js';
import { generateId, now } from '@agi-os/kernel';

// ---------------------------------------------------------------------------
// LocalVectorEngine — deterministic feature extraction + cosine similarity
// ---------------------------------------------------------------------------
export class LocalVectorEngine {
  private dimension: number;
  private documents: Map<string, VectorDocument> = new Map();

  constructor(config?: Partial<VectorStoreConfig>) {
    this.dimension = config?.dimension ?? 128;
  }

  /**
   * Generate a deterministic feature vector from text.
   * Uses word-level trigrams with position-dependent hashing for richer signal.
   */
  generateEmbedding(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);

    // Word-level features: each word contributes to multiple positions
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];

      // Primary hash: full word
      const h1 = this.hashWord(word, 0);
      vector[h1 % this.dimension] += 1.0;

      // Secondary hash: word with position context
      const h2 = this.hashWord(word, wi * 31);
      vector[h2 % this.dimension] += 0.8;

      // Tertiary: prefix trigram (captures word roots)
      if (word.length >= 3) {
        const prefix = word.slice(0, 3);
        const h3 = this.hashWord(prefix, 17);
        vector[h3 % this.dimension] += 0.5;
      }
    }

    // Character trigram features (captures sub-word patterns)
    for (let i = 0; i <= normalized.length - 3; i++) {
      const tri = normalized.slice(i, i + 3);
      const h = this.hashWord(tri, i * 7);
      vector[h % this.dimension] += 0.2;
    }

    // L2 normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map((val) => val / magnitude);
  }

  private hashWord(word: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) - h + word.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /**
   * Cosine similarity between two L2-normalized vectors.
   * Since vectors are pre-normalized, this is just the dot product.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  /**
   * Insert a document with auto-generated embedding
   */
  insert(text: string, metadata?: Record<string, unknown>): VectorDocument {
    const id = generateId();
    const vector = this.generateEmbedding(text);
    const doc: VectorDocument = {
      id,
      text,
      vector,
      metadata: metadata ?? {},
      createdAt: now().toISOString(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  /**
   * Insert with explicit ID
   */
  insertWithId(id: string, text: string, metadata?: Record<string, unknown>): VectorDocument {
    const vector = this.generateEmbedding(text);
    const doc: VectorDocument = {
      id,
      text,
      vector,
      metadata: metadata ?? {},
      createdAt: now().toISOString(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  /**
   * Search by query text — returns top-k most similar documents
   */
  search(queryText: string, topK: number = 5): VectorSearchResult[] {
    const queryVector = this.generateEmbedding(queryText);
    const results: VectorSearchResult[] = [];

    for (const doc of this.documents.values()) {
      const score = this.cosineSimilarity(queryVector, doc.vector);
      results.push({ document: doc, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Get document by ID
   */
  get(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Delete document by ID
   */
  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Get document count
   */
  count(): number {
    return this.documents.size;
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Get all documents
   */
  getAll(): VectorDocument[] {
    return Array.from(this.documents.values());
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createLocalVectorEngine(config?: Partial<VectorStoreConfig>): LocalVectorEngine {
  return new LocalVectorEngine(config);
}
