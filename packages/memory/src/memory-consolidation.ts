// ============================================================================
// AGI OS - Memory Consolidation
// Promote, reinforce, decay, merge, remove stale memories
// ============================================================================

import { now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  MemoryStore,
  ConsolidationResult,
  WorkingMemoryContent,
  EpisodicMemoryContent,
  SemanticMemoryContent,
  ProceduralMemoryContent,
  MetaMemoryContent,
} from './types.js';

// ---------------------------------------------------------------------------
// Memory Consolidation — keeps memory healthy and relevant
// ---------------------------------------------------------------------------
export class MemoryConsolidation {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Run full consolidation cycle
   */
  async consolidate(): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      promoted: [],
      reinforced: [],
      decayed: [],
      merged: [],
      removed: [],
      timestamp: now().toISOString(),
    };

    // 1. Decay old memories
    const decayed = await this.decayOld();
    result.decayed = decayed;

    // 2. Reinforce frequently accessed memories
    const reinforced = await this.reinforceFrequent();
    result.reinforced = reinforced;

    // 3. Remove stale low-confidence memories
    const removed = await this.removeStale();
    result.removed = removed;

    // 4. Merge duplicate semantic memories
    const merged = await this.mergeDuplicates();
    result.merged = merged;

    return result;
  }

  /**
   * Decay old memories based on age and access pattern
   */
  async decayOld(
    maxAgeDays: number = 90,
    decayFactor: number = 0.95
  ): Promise<string[]> {
    const records = await this.store.list({ limit: 10000 });
    const decayed: string[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    for (const record of records) {
      if (record.type === 'working') continue; // Don't decay working memory

      const createdAt = new Date(record.createdAt);
      if (createdAt < cutoff) {
        const daysSinceCreation =
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const ageFactor = Math.pow(decayFactor, daysSinceCreation / 30);
        const accessFactor = Math.min(1.5, 1 + record.accessCount * 0.05);
        const newConfidence = record.confidence * ageFactor * accessFactor;

        if (newConfidence < 0.05) {
          await this.store.delete(record.id);
          decayed.push(record.id);
        } else {
          record.confidence = Math.round(newConfidence * 100) / 100;
          record.updatedAt = now().toISOString();
          await this.store.save(record);
          decayed.push(record.id);
        }
      }
    }

    return decayed;
  }

  /**
   * Reinforce frequently accessed memories
   */
  async reinforceFrequent(
    minAccessCount: number = 5,
    boost: number = 0.05
  ): Promise<string[]> {
    const records = await this.store.list({ limit: 10000 });
    const reinforced: string[] = [];

    for (const record of records) {
      if (record.accessCount >= minAccessCount) {
        const newConfidence = Math.min(1.0, record.confidence + boost);
        if (newConfidence !== record.confidence) {
          record.confidence = Math.round(newConfidence * 100) / 100;
          record.updatedAt = now().toISOString();
          await this.store.save(record);
          reinforced.push(record.id);
        }
      }
    }

    return reinforced;
  }

  /**
   * Remove stale low-confidence memories
   */
  async removeStale(
    maxAgeDays: number = 180,
    minConfidence: number = 0.1
  ): Promise<string[]> {
    const records = await this.store.list({ limit: 10000 });
    const removed: string[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    for (const record of records) {
      if (record.type === 'working') continue;

      const createdAt = new Date(record.createdAt);
      if (createdAt < cutoff && record.confidence < minConfidence) {
        await this.store.delete(record.id);
        removed.push(record.id);
      }
    }

    return removed;
  }

  /**
   * Merge duplicate semantic memories (same S-P-O)
   */
  async mergeDuplicates(): Promise<string[]> {
    const records = await this.store.list({
      type: 'semantic',
      limit: 10000,
    });
    const merged: string[] = [];
    const seen = new Map<string, MemoryRecord>();

    for (const record of records) {
      const content = record.content as SemanticMemoryContent;
      const key = `${content.subject}::${content.predicate}::${content.object}`;

      if (seen.has(key)) {
        const existing = seen.get(key)!;
        const existingContent = existing.content as SemanticMemoryContent;

        // Keep the stronger one, reinforce it
        if (record.confidence > existing.confidence) {
          existingContent.strength = Math.min(
            1.0,
            Math.max(existingContent.strength, content.strength) + 0.1
          );
          existing.confidence = existingContent.strength;
          existing.evidenceRefs.push(...record.evidenceRefs);
          existing.sourceEventIds.push(...record.sourceEventIds);
          existing.accessCount += record.accessCount;
          existing.updatedAt = now().toISOString();
          await this.store.save(existing);
        }

        await this.store.delete(record.id);
        merged.push(record.id);
      } else {
        seen.set(key, record);
      }
    }

    return merged;
  }

  /**
   * Get consolidation stats
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  }> {
    const records = await this.store.list({ limit: 10000 });

    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const record of records) {
      byType[record.type] = (byType[record.type] ?? 0) + 1;
      totalConfidence += record.confidence;

      if (!oldest || record.createdAt < oldest) oldest = record.createdAt;
      if (!newest || record.createdAt > newest) newest = record.createdAt;
    }

    return {
      total: records.length,
      byType,
      avgConfidence:
        records.length > 0
          ? Math.round((totalConfidence / records.length) * 100) / 100
          : 0,
      oldestRecord: oldest,
      newestRecord: newest,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMemoryConsolidation(store: MemoryStore): MemoryConsolidation {
  return new MemoryConsolidation(store);
}
