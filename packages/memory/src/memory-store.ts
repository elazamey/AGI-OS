// ============================================================================
// AGI OS - In-Memory Store
// Default in-memory implementation of MemoryStore
// ============================================================================

import type { MemoryRecord, MemoryStore, MemoryFilter } from './types.js';

// ---------------------------------------------------------------------------
// In-Memory Store
// ---------------------------------------------------------------------------
export class InMemoryMemoryStore implements MemoryStore {
  private records: Map<string, MemoryRecord> = new Map();

  async save(record: MemoryRecord): Promise<void> {
    this.records.set(record.id, { ...record, content: { ...record.content } as any });
  }

  async get(id: string): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record, content: { ...record.content } as any } : null;
  }

  async list(filter?: MemoryFilter): Promise<MemoryRecord[]> {
    let results = Array.from(this.records.values());

    if (filter) {
      if (filter.type) {
        results = results.filter((r) => r.type === filter.type);
      }
      if (filter.minConfidence !== undefined) {
        results = results.filter((r) => r.confidence >= filter.minConfidence!);
      }
      if (filter.maxConfidence !== undefined) {
        results = results.filter((r) => r.confidence <= filter.maxConfidence!);
      }
      if (filter.createdAfter) {
        results = results.filter((r) => r.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        results = results.filter((r) => r.createdAt <= filter.createdBefore!);
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? results.length;

    return results.slice(offset, offset + limit).map((r) => ({
      ...r,
      content: { ...r.content } as any,
    }));
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async count(filter?: MemoryFilter): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      return this.records.size;
    }
    const results = await this.list({ ...filter, limit: Number.MAX_SAFE_INTEGER });
    return results.length;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMemoryStore(): MemoryStore {
  return new InMemoryMemoryStore();
}
