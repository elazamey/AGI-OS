// ============================================================================
// AGI OS - Working Memory
// Current goal, plan, active observations, scratchpad
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  MemoryRecord,
  WorkingMemoryContent,
  PlanStep,
  Observation,
} from './types.js';
import type { MemoryStore } from './types.js';

// ---------------------------------------------------------------------------
// Working Memory — the "RAM" of the cognitive system
// ---------------------------------------------------------------------------
export class WorkingMemory {
  private store: MemoryStore;
  private activeId: string | null = null;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Initialize working memory for a mission
   */
  async initialize(missionId: string, goal: string): Promise<MemoryRecord> {
    const content: WorkingMemoryContent = {
      kind: 'working',
      currentGoal: goal,
      currentPlan: [],
      activeObservations: [],
      scratchpad: { missionId },
    };

    const record: MemoryRecord = {
      id: generateId(),
      type: 'working',
      content,
      sourceEventIds: [],
      evidenceRefs: [],
      confidence: 1.0,
      accessCount: 0,
      lastAccessedAt: now().toISOString(),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
      metadata: { missionId },
    };

    await this.store.save(record);
    this.activeId = record.id;
    return record;
  }

  /**
   * Get the active working memory record
   */
  async getActive(): Promise<MemoryRecord | null> {
    if (!this.activeId) return null;
    const record = await this.store.get(this.activeId);
    if (!record) {
      this.activeId = null;
      return null;
    }
    record.accessCount++;
    record.lastAccessedAt = now().toISOString();
    await this.store.save(record);
    return record;
  }

  /**
   * Set the current goal
   */
  async setGoal(goal: string): Promise<void> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;
    content.currentGoal = goal;
    record.updatedAt = now().toISOString();
    await this.store.save(record);
  }

  /**
   * Set the current plan
   */
  async setPlan(steps: Array<{ description: string; dependsOn?: string[] }>): Promise<void> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;
    content.currentPlan = steps.map((s, i) => ({
      id: `step-${i}`,
      description: s.description,
      status: 'pending',
      dependsOn: s.dependsOn ?? [],
    }));
    record.updatedAt = now().toISOString();
    await this.store.save(record);
  }

  /**
   * Update plan step status
   */
  async updateStepStatus(
    stepId: string,
    status: PlanStep['status']
  ): Promise<void> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;
    const step = content.currentPlan.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      record.updatedAt = now().toISOString();
      await this.store.save(record);
    }
  }

  /**
   * Add an observation
   */
  async addObservation(obs: {
    source: string;
    content: unknown;
    confidence?: number;
  }): Promise<Observation> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;

    const observation: Observation = {
      id: generateId(),
      source: obs.source,
      content: obs.content,
      confidence: obs.confidence ?? 1.0,
      timestamp: now().toISOString(),
    };

    content.activeObservations.push(observation);
    record.updatedAt = now().toISOString();
    await this.store.save(record);
    return observation;
  }

  /**
   * Remove an observation
   */
  async removeObservation(obsId: string): Promise<boolean> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;
    const idx = content.activeObservations.findIndex((o) => o.id === obsId);
    if (idx >= 0) {
      content.activeObservations.splice(idx, 1);
      record.updatedAt = now().toISOString();
      await this.store.save(record);
      return true;
    }
    return false;
  }

  /**
   * Update scratchpad
   */
  async setScratchpad(key: string, value: unknown): Promise<void> {
    const record = await this.requireActive();
    const content = record.content as WorkingMemoryContent;
    content.scratchpad[key] = value;
    record.updatedAt = now().toISOString();
    await this.store.save(record);
  }

  /**
   * Clear working memory
   */
  async clear(): Promise<void> {
    this.activeId = null;
  }

  /**
   * Get current goal
   */
  async getCurrentGoal(): Promise<string | null> {
    const record = await this.getActive();
    if (!record) return null;
    return (record.content as WorkingMemoryContent).currentGoal;
  }

  /**
   * Get current plan
   */
  async getCurrentPlan(): Promise<PlanStep[]> {
    const record = await this.getActive();
    if (!record) return [];
    return (record.content as WorkingMemoryContent).currentPlan;
  }

  /**
   * Get observations
   */
  async getObservations(): Promise<Observation[]> {
    const record = await this.getActive();
    if (!record) return [];
    return (record.content as WorkingMemoryContent).activeObservations;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  private async requireActive(): Promise<MemoryRecord> {
    const record = await this.getActive();
    if (!record) throw new Error('No active working memory');
    return record;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createWorkingMemory(store: MemoryStore): WorkingMemory {
  return new WorkingMemory(store);
}
