// ============================================================================
// AGI OS - Semantic Memory
// Facts, concepts, relationships — what is known
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  SemanticMemoryContent,
} from './types.js';
import type { MemoryStore } from './types.js';

// ---------------------------------------------------------------------------
// Semantic Memory — structured knowledge
// ---------------------------------------------------------------------------
export class SemanticMemory {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Store a fact
   */
  async storeFact(params: {
    subject: string;
    predicate: string;
    object: string;
    source: string;
    evidenceRefs?: string[];
    sourceEventIds?: string[];
    strength?: number;
  }): Promise<MemoryRecord> {
    // Check for existing fact with same S-P-O
    const existing = await this.findFact(
      params.subject,
      params.predicate,
      params.object
    );

    if (existing) {
      // Reinforce existing fact
      const content = existing.content as SemanticMemoryContent;
      content.strength = Math.min(1.0, content.strength + 0.1);
      existing.accessCount++;
      existing.lastAccessedAt = now().toISOString();
      existing.updatedAt = now().toISOString();
      if (params.evidenceRefs) {
        existing.evidenceRefs.push(...params.evidenceRefs);
      }
      await this.store.save(existing);
      return existing;
    }

    const content: SemanticMemoryContent = {
      kind: 'semantic',
      category: 'fact',
      subject: params.subject,
      predicate: params.predicate,
      object: params.object,
      source: params.source,
      strength: params.strength ?? 0.7,
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'semantic',
      content,
      sourceEventIds: params.sourceEventIds ?? [],
      evidenceRefs: params.evidenceRefs ?? [],
      confidence: content.strength,
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: {
        subject: params.subject,
        predicate: params.predicate,
      },
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Store a relationship
   */
  async storeRelationship(params: {
    subject: string;
    predicate: string;
    object: string;
    source: string;
    evidenceRefs?: string[];
  }): Promise<MemoryRecord> {
    return this.storeFact({ ...params, strength: 0.8 });
  }

  /**
   * Find a specific fact
   */
  async findFact(
    subject: string,
    predicate: string,
    object: string
  ): Promise<MemoryRecord | null> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return (
      records.find((r) => {
        const c = r.content as SemanticMemoryContent;
        return (
          c.subject === subject &&
          c.predicate === predicate &&
          c.object === object
        );
      }) ?? null
    );
  }

  /**
   * Query facts by subject
   */
  async queryBySubject(subject: string): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as SemanticMemoryContent;
      return c.subject === subject;
    });
  }

  /**
   * Query facts by predicate
   */
  async queryByPredicate(predicate: string): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as SemanticMemoryContent;
      return c.predicate === predicate;
    });
  }

  /**
   * Query facts by object
   */
  async queryByObject(object: string): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as SemanticMemoryContent;
      return c.object === object;
    });
  }

  /**
   * Search facts by text (subject, predicate, or object contains text)
   */
  async search(text: string): Promise<MemoryRecord[]> {
    const lower = text.toLowerCase();
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as SemanticMemoryContent;
      return (
        c.subject.toLowerCase().includes(lower) ||
        c.predicate.toLowerCase().includes(lower) ||
        c.object.toLowerCase().includes(lower)
      );
    });
  }

  /**
   * Get all facts
   */
  async getAllFacts(): Promise<MemoryRecord[]> {
    return this.store.list({ type: 'semantic', limit: 10000 });
  }

  /**
   * Get strongest facts
   */
  async getStrongest(limit: number = 10): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    return records
      .sort((a, b) => {
        const aStrength = (a.content as SemanticMemoryContent).strength;
        const bStrength = (b.content as SemanticMemoryContent).strength;
        return bStrength - aStrength;
      })
      .slice(0, limit);
  }

  /**
   * Decay weak facts over time
   */
  async decay(factor: number = 0.95): Promise<number> {
    const records = await this.store.list({ type: 'semantic', limit: 10000 });
    let decayed = 0;
    for (const record of records) {
      const content = record.content as SemanticMemoryContent;
      const newStrength = content.strength * factor;
      if (newStrength < 0.1) {
        await this.store.delete(record.id);
        decayed++;
      } else {
        content.strength = Math.round(newStrength * 100) / 100;
        record.confidence = content.strength;
        record.updatedAt = now().toISOString();
        await this.store.save(record);
        decayed++;
      }
    }
    return decayed;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createSemanticMemory(store: MemoryStore): SemanticMemory {
  return new SemanticMemory(store);
}
