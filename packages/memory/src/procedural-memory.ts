// ============================================================================
// AGI OS - Procedural Memory
// Skills, workflows, successful strategies — how to do things
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  ProceduralMemoryContent,
  ProcedureStep,
} from './types.js';
import type { MemoryStore } from './types.js';

// ---------------------------------------------------------------------------
// Procedural Memory — how-to knowledge
// ---------------------------------------------------------------------------
export class ProceduralMemory {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Store a procedure
   */
  async storeProcedure(params: {
    skill: string;
    description: string;
    steps: ProcedureStep[];
    evidenceRefs?: string[];
    sourceEventIds?: string[];
  }): Promise<MemoryRecord> {
    // Check for existing procedure with same skill
    const existing = await this.findBySkill(params.skill);

    if (existing) {
      // Reinforce existing procedure
      const content = existing.content as ProceduralMemoryContent;
      content.successCount++;
      existing.accessCount++;
      existing.lastAccessedAt = now().toISOString();
      existing.updatedAt = now().toISOString();
      if (params.evidenceRefs) {
        existing.evidenceRefs.push(...params.evidenceRefs);
      }
      existing.confidence = Math.min(
        1.0,
        existing.confidence + 0.05
      );
      await this.store.save(existing);
      return existing;
    }

    const content: ProceduralMemoryContent = {
      kind: 'procedural',
      skill: params.skill,
      description: params.description,
      steps: params.steps,
      successCount: 1,
      failureCount: 0,
      avgDuration: 0,
      lastUsedAt: now().toISOString(),
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'procedural',
      content,
      sourceEventIds: params.sourceEventIds ?? [],
      evidenceRefs: params.evidenceRefs ?? [],
      confidence: 0.7,
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: {
        skill: params.skill,
      },
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Record a procedure success
   */
  async recordSuccess(skill: string, duration: number): Promise<void> {
    const record = await this.findBySkill(skill);
    if (!record) return;
    const content = record.content as ProceduralMemoryContent;
    content.successCount++;
    content.lastUsedAt = now().toISOString();
    content.avgDuration =
      (content.avgDuration * (content.successCount + content.failureCount - 1) + duration) /
      (content.successCount + content.failureCount);
    record.confidence = Math.min(
      1.0,
      content.successCount / (content.successCount + content.failureCount + 1) + 0.1
    );
    record.accessCount++;
    record.lastAccessedAt = now().toISOString();
    record.updatedAt = now().toISOString();
    await this.store.save(record);
  }

  /**
   * Record a procedure failure
   */
  async recordFailure(skill: string): Promise<void> {
    const record = await this.findBySkill(skill);
    if (!record) return;
    const content = record.content as ProceduralMemoryContent;
    content.failureCount++;
    content.lastUsedAt = now().toISOString();
    record.confidence = Math.max(
      0.0,
      content.successCount / (content.successCount + content.failureCount + 1) - 0.05
    );
    record.accessCount++;
    record.lastAccessedAt = now().toISOString();
    record.updatedAt = now().toISOString();
    await this.store.save(record);
  }

  /**
   * Find procedure by skill name
   */
  async findBySkill(skill: string): Promise<MemoryRecord | null> {
    const records = await this.store.list({ type: 'procedural', limit: 10000 });
    return (
      records.find(
        (r) => (r.content as ProceduralMemoryContent).skill === skill
      ) ?? null
    );
  }

  /**
   * Search procedures by text
   */
  async search(text: string): Promise<MemoryRecord[]> {
    const lower = text.toLowerCase();
    const records = await this.store.list({ type: 'procedural', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as ProceduralMemoryContent;
      return (
        c.skill.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower)
      );
    });
  }

  /**
   * Get all procedures
   */
  async getAll(): Promise<MemoryRecord[]> {
    return this.store.list({ type: 'procedural', limit: 10000 });
  }

  /**
   * Get most reliable procedures
   */
  async getMostReliable(limit: number = 10): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'procedural', limit: 10000 });
    return records
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Get success rate for a skill
   */
  async getSuccessRate(skill: string): Promise<number> {
    const record = await this.findBySkill(skill);
    if (!record) return 0;
    const content = record.content as ProceduralMemoryContent;
    const total = content.successCount + content.failureCount;
    return total === 0 ? 0 : content.successCount / total;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createProceduralMemory(store: MemoryStore): ProceduralMemory {
  return new ProceduralMemory(store);
}
