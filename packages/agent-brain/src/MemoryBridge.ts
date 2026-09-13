import { generateId } from '@agi-os/kernel';
import type { BrainObservation } from './types.js';
import type { WorkingMemory } from '@agi-os/memory';

export class MemoryBridge {
  constructor(private deps: {
    workingMemory: WorkingMemory;
  }) {}

  async recordObservation(missionId: string, observation: BrainObservation): Promise<void> {
    await this.deps.workingMemory.addObservation({
      source: observation.skillId,
      content: observation.output,
      confidence: observation.success ? 1.0 : 0.0,
    });
  }

  async getRelevantContext(missionId: string): Promise<Record<string, unknown>> {
    const goal = await this.deps.workingMemory.getCurrentGoal();
    const plan = await this.deps.workingMemory.getCurrentPlan();
    return { goal, plan };
  }
}
