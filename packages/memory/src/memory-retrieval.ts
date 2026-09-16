// ============================================================================
// AGI OS - Memory Retrieval
// Query-based retrieval with ranking
// ============================================================================

import type {
  MemoryRecord,
  MemoryStore,
  RetrievalQuery,
  RetrievalResult,
  WorkingMemoryContent,
  EpisodicMemoryContent,
} from './types.js';

// ---------------------------------------------------------------------------
// Memory Retrieval — finds and ranks relevant memories
// ---------------------------------------------------------------------------
export class MemoryRetrieval {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Retrieve memories matching a query
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const records = await this.store.list({
      type: query.type,
      minConfidence: query.minConfidence,
      limit: 10000,
    });

    const scored = records.map((record) => ({
      record,
      score: this.scoreRecord(record, query),
      matchedBy: this.getMatchedBy(record, query),
    }));

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);
  }

  /**
   * Retrieve by text search across all types
   */
  async search(text: string, limit: number = 10): Promise<RetrievalResult[]> {
    const query: RetrievalQuery = { text, limit, includeEvidence: false };
    return this.retrieve(query);
  }

  /**
   * Retrieve by mission ID
   */
  async byMissionId(
    missionId: string,
    limit: number = 10
  ): Promise<RetrievalResult[]> {
    const records = await this.store.list({ limit: 10000 });
    const results: RetrievalResult[] = [];

    for (const record of records) {
      let matched = false;
      switch (record.type) {
        case 'working': {
          const c = record.content as WorkingMemoryContent;
          matched = c.scratchpad?.missionId === missionId;
          break;
        }
        case 'episodic': {
          const c = record.content as EpisodicMemoryContent;
          matched = c.missionId === missionId;
          break;
        }
        default:
          matched = record.metadata?.missionId === missionId;
      }
      if (matched) {
        results.push({
          record,
          score: record.confidence,
          matchedBy: 'missionId',
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get most accessed memories
   */
  async mostAccessed(limit: number = 10): Promise<MemoryRecord[]> {
    const records = await this.store.list({ limit: 10000 });
    return records
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get most recent memories
   */
  async mostRecent(limit: number = 10): Promise<MemoryRecord[]> {
    const records = await this.store.list({ limit });
    return records.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get high confidence memories
   */
  async highConfidence(
    minConfidence: number = 0.7,
    limit: number = 10
  ): Promise<MemoryRecord[]> {
    return this.store.list({
      minConfidence,
      limit,
    });
  }

  // -----------------------------------------------------------------------
  // Private — scoring
  // -----------------------------------------------------------------------
  private scoreRecord(record: MemoryRecord, query: RetrievalQuery): number {
    let score = 0;

    // Base score from confidence
    score += record.confidence * 0.3;

    // Recency bonus (more recent = higher score)
    const age = Date.now() - new Date(record.createdAt).getTime();
    const dayAge = age / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 1 - dayAge / 365) * 0.2;
    score += recencyBonus;

    // Access frequency bonus
    const accessBonus = Math.min(0.2, record.accessCount * 0.02);
    score += accessBonus;

    // Text match bonus
    if (query.text) {
      const textScore = this.textMatchScore(record, query.text);
      score += textScore * 0.3;
    }

    return Math.round(score * 100) / 100;
  }

  private textMatchScore(record: MemoryRecord, text: string): number {
    const lower = text.toLowerCase();
    const contentStr = JSON.stringify(record.content).toLowerCase();

    if (contentStr.includes(lower)) return 1.0;

    const words = lower.split(/\s+/);
    let matches = 0;
    for (const word of words) {
      if (word.length > 2 && contentStr.includes(word)) {
        matches++;
      }
    }
    return words.length > 0 ? matches / words.length : 0;
  }

  private getMatchedBy(record: MemoryRecord, query: RetrievalQuery): string {
    if (query.text) return 'text';
    if (query.type) return 'type';
    if (query.missionId) return 'missionId';
    return 'default';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMemoryRetrieval(store: MemoryStore): MemoryRetrieval {
  return new MemoryRetrieval(store);
}
