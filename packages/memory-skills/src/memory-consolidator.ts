import { now } from '@agi-os/kernel';
import type { MemoryItem } from './types.js';
import { MemoryStore } from './memory-store.js';

export class MemoryConsolidator {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  consolidate(): { promoted: number; merged: number; forgotten: number } {
    let promoted = 0;
    let merged = 0;
    let forgotten = 0;

    const working = this.store.getByTier('working');
    for (const item of working) {
      if (item.accessCount > 3 && item.importance > 0.7) {
        item.tier = 'session';
        promoted++;
      }
    }

    const session = this.store.getByTier('session');
    for (const item of session) {
      if (item.accessCount > 5 && item.importance > 0.8) {
        item.tier = 'longterm';
        promoted++;
      }
    }

    for (const item of session) {
      if (item.importance < 0.2 && item.accessCount === 0) {
        this.store.delete(item.id);
        forgotten++;
      }
    }

    return { promoted, merged, forgotten };
  }

  forget(lowImportanceThreshold: number = 0.1): number {
    let count = 0;
    for (const item of this.store.query({ limit: 1000 })) {
      if (item.importance < lowImportanceThreshold && item.accessCount === 0) {
        this.store.delete(item.id);
        count++;
      }
    }
    return count;
  }

  deduplicate(): number {
    const all = this.store.query({ limit: 10000 });
    const seen = new Map<string, string[]>();
    let removed = 0;

    for (const item of all) {
      const key = item.content.toLowerCase().trim();
      const existing = seen.get(key);
      if (existing) {
        existing.push(item.id);
      } else {
        seen.set(key, [item.id]);
      }
    }

    for (const ids of seen.values()) {
      if (ids.length > 1) {
        for (let i = 1; i < ids.length; i++) {
          this.store.delete(ids[i]);
          removed++;
        }
      }
    }

    return removed;
  }
}
