// ============================================================================
// AGI OS - Meta Memory
// Confidence, capability reliability, failure patterns — self-awareness
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  MetaMemoryContent,
} from './types.js';
import type { MemoryStore } from './types.js';

// ---------------------------------------------------------------------------
// Meta Memory — self-knowledge about capabilities and reliability
// ---------------------------------------------------------------------------
export class MetaMemory {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Record a confidence assessment
   */
  async recordConfidence(params: {
    subject: string;
    metric: string;
    value: number;
    sampleSize: number;
    evidenceRefs?: string[];
  }): Promise<MemoryRecord> {
    const existing = await this.findAssessment(
      'confidence',
      params.subject,
      params.metric
    );

    if (existing) {
      const content = existing.content as MetaMemoryContent;
      const oldWeight = content.sampleSize / (content.sampleSize + params.sampleSize);
      const newWeight = params.sampleSize / (content.sampleSize + params.sampleSize);
      content.value = content.value * oldWeight + params.value * newWeight;
      content.sampleSize += params.sampleSize;
      content.trend = this.computeTrend(content.value, params.value);
      existing.confidence = Math.min(1.0, content.sampleSize / 100);
      existing.accessCount++;
      existing.lastAccessedAt = now().toISOString();
      existing.updatedAt = now().toISOString();
      if (params.evidenceRefs) {
        existing.evidenceRefs.push(...params.evidenceRefs);
      }
      await this.store.save(existing);
      return existing;
    }

    const content: MetaMemoryContent = {
      kind: 'meta',
      category: 'confidence',
      subject: params.subject,
      metric: params.metric,
      value: params.value,
      sampleSize: params.sampleSize,
      trend: 'stable',
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'meta',
      content,
      sourceEventIds: [],
      evidenceRefs: params.evidenceRefs ?? [],
      confidence: Math.min(1.0, params.sampleSize / 100),
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: {
        subject: params.subject,
        metric: params.metric,
      },
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Record capability reliability
   */
  async recordReliability(params: {
    toolId: string;
    successRate: number;
    sampleSize: number;
    evidenceRefs?: string[];
  }): Promise<MemoryRecord> {
    return this.recordConfidence({
      subject: params.toolId,
      metric: 'reliability',
      value: params.successRate,
      sampleSize: params.sampleSize,
      evidenceRefs: params.evidenceRefs,
    });
  }

  /**
   * Record a failure pattern
   */
  async recordFailurePattern(params: {
    subject: string;
    pattern: string;
    frequency: number;
    evidenceRefs?: string[];
  }): Promise<MemoryRecord> {
    const content: MetaMemoryContent = {
      kind: 'meta',
      category: 'failure_pattern',
      subject: params.subject,
      metric: params.pattern,
      value: params.frequency,
      sampleSize: 1,
      trend: 'stable',
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'meta',
      content,
      sourceEventIds: [],
      evidenceRefs: params.evidenceRefs ?? [],
      confidence: 0.5,
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: {
        subject: params.subject,
        pattern: params.pattern,
      },
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Find assessment by category, subject, and metric
   */
  async findAssessment(
    category: MetaMemoryContent['category'],
    subject: string,
    metric: string
  ): Promise<MemoryRecord | null> {
    const records = await this.store.list({ type: 'meta', limit: 10000 });
    return (
      records.find((r) => {
        const c = r.content as MetaMemoryContent;
        return c.category === category && c.subject === subject && c.metric === metric;
      }) ?? null
    );
  }

  /**
   * Get all assessments for a subject
   */
  async getAssessmentsForSubject(subject: string): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'meta', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as MetaMemoryContent;
      return c.subject === subject;
    });
  }

  /**
   * Get reliability for a tool
   */
  async getReliability(toolId: string): Promise<number | null> {
    const record = await this.findAssessment('confidence', toolId, 'reliability');
    if (!record) return null;
    return (record.content as MetaMemoryContent).value;
  }

  /**
   * Get failure patterns for a subject
   */
  async getFailurePatterns(subject: string): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'meta', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as MetaMemoryContent;
      return c.category === 'failure_pattern' && c.subject === subject;
    });
  }

  /**
   * Get declining assessments (needs attention)
   */
  async getDeclining(): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'meta', limit: 10000 });
    return records.filter((r) => {
      const c = r.content as MetaMemoryContent;
      return c.trend === 'declining';
    });
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  private computeTrend(
    oldValue: number,
    newValue: number
  ): MetaMemoryContent['trend'] {
    const diff = newValue - oldValue;
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMetaMemory(store: MemoryStore): MetaMemory {
  return new MetaMemory(store);
}
