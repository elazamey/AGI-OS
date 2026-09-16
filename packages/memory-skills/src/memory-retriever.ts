import type { MemoryItem, MemoryQuery } from './types.js';
import type { MemoryStore } from './memory-store.js';

export class MemoryRetriever {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  retrieve(query: MemoryQuery): MemoryItem[] {
    return this.store.query({
      text: query.text,
      tier: query.tier,
      tags: query.tags,
      missionId: query.missionId,
      minImportance: query.minImportance,
      limit: query.limit ?? 10,
    });
  }

  retrieveRelevant(query: string, limit: number = 5): MemoryItem[] {
    return this.store.query({ text: query, limit });
  }

  retrieveByMission(missionId: string): MemoryItem[] {
    return this.store.query({ missionId, limit: 100 });
  }

  retrieveByTier(tier: MemoryTier, limit: number = 20): MemoryItem[] {
    return this.store.query({ tier, limit });
  }

  getMostImportant(limit: number = 10): MemoryItem[] {
    return this.store.query({ minImportance: 0.8, limit });
  }

  getRecent(limit: number = 10): MemoryItem[] {
    return this.store.query({ limit });
  }
}

import type { MemoryTier } from './types.js';
