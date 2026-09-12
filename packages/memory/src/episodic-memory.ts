// ============================================================================
// AGI OS - Episodic Memory
// Missions, actions, failures, outcomes — what happened
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  EpisodicMemoryContent,
  TaskSummary,
  KeyEvent,
} from './types.js';
import type { MemoryStore, MemoryFilter } from './types.js';

// ---------------------------------------------------------------------------
// Episodic Memory — records of what happened
// ---------------------------------------------------------------------------
export class EpisodicMemory {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Record a completed mission episode
   */
  async recordEpisode(params: {
    missionId: string;
    missionGoal: string;
    outcome: EpisodicMemoryContent['outcome'];
    duration: number;
    taskSummaries: TaskSummary[];
    keyEvents: KeyEvent[];
    lessonsLearned?: string[];
    evidenceRefs?: string[];
    sourceEventIds?: string[];
  }): Promise<MemoryRecord> {
    const content: EpisodicMemoryContent = {
      kind: 'episodic',
      missionId: params.missionId,
      missionGoal: params.missionGoal,
      outcome: params.outcome,
      duration: params.duration,
      taskSummaries: params.taskSummaries,
      keyEvents: params.keyEvents,
      lessonsLearned: params.lessonsLearned ?? [],
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'episodic',
      content,
      sourceEventIds: params.sourceEventIds ?? [],
      evidenceRefs: params.evidenceRefs ?? [],
      confidence: this.computeConfidence(params.outcome, params.taskSummaries),
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: {
        missionId: params.missionId,
        outcome: params.outcome,
      },
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Get episode by mission ID
   */
  async getByMissionId(missionId: string): Promise<MemoryRecord | null> {
    const records = await this.store.list({ type: 'episodic', limit: 1000 });
    return records.find(
      (r) => (r.content as EpisodicMemoryContent).missionId === missionId
    ) ?? null;
  }

  /**
   * Get all episodes with a specific outcome
   */
  async getByOutcome(
    outcome: EpisodicMemoryContent['outcome']
  ): Promise<MemoryRecord[]> {
    const records = await this.store.list({ type: 'episodic', limit: 1000 });
    return records.filter(
      (r) => (r.content as EpisodicMemoryContent).outcome === outcome
    );
  }

  /**
   * Get recent episodes
   */
  async getRecent(limit: number = 10): Promise<MemoryRecord[]> {
    return this.store.list({ type: 'episodic', limit });
  }

  /**
   * Get episodes where a specific task failed
   */
  async getFailureEpisodes(): Promise<MemoryRecord[]> {
    return this.getByOutcome('failure');
  }

  /**
   * Get all lessons learned across episodes
   */
  async getAllLessons(): Promise<string[]> {
    const records = await this.store.list({ type: 'episodic', limit: 1000 });
    const lessons: string[] = [];
    for (const record of records) {
      const content = record.content as EpisodicMemoryContent;
      lessons.push(...content.lessonsLearned);
    }
    return [...new Set(lessons)]; // deduplicate
  }

  /**
   * Get success rate
   */
  async getSuccessRate(): Promise<number> {
    const records = await this.store.list({ type: 'episodic', limit: 1000 });
    if (records.length === 0) return 0;
    const successes = records.filter(
      (r) => (r.content as EpisodicMemoryContent).outcome === 'success'
    ).length;
    return successes / records.length;
  }

  /**
   * Access an episode (increments access count)
   */
  async access(missionId: string): Promise<MemoryRecord | null> {
    const record = await this.getByMissionId(missionId);
    if (!record) return null;
    record.accessCount++;
    record.lastAccessedAt = now().toISOString();
    await this.store.save(record);
    return record;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  private computeConfidence(
    outcome: EpisodicMemoryContent['outcome'],
    taskSummaries: TaskSummary[]
  ): number {
    let base: number;
    switch (outcome) {
      case 'success': base = 0.9; break;
      case 'partial': base = 0.6; break;
      case 'failure': base = 0.3; break;
      case 'cancelled': base = 0.5; break;
      default: base = 0.5;
    }

    if (taskSummaries.length === 0) return base;

    const taskSuccessRate =
      taskSummaries.filter((t) => t.outcome === 'success').length /
      taskSummaries.length;

    return Math.round((base * 0.7 + taskSuccessRate * 0.3) * 100) / 100;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createEpisodicMemory(store: MemoryStore): EpisodicMemory {
  return new EpisodicMemory(store);
}
