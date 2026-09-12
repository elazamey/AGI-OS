// ============================================================================
// AGI OS - Context Builder
// Constructs CognitiveContext from goal + world state + memory + capabilities
// ============================================================================

import { now } from '@agi-os/kernel';
import type { MemoryStore, MemoryRecord, EpisodicMemoryContent } from '@agi-os/memory';
import type { ToolRegistry, CapabilityRegistry } from '@agi-os/tools';
import type {
  CognitiveContext,
  ContextMemory,
  ContextFailure,
  MissionStateSnapshot,
  WorldState,
  WorldConstraint,
} from './types.js';
import type { WorldStateManager } from './world-state.js';

// ---------------------------------------------------------------------------
// Context Builder
// ---------------------------------------------------------------------------
export class ContextBuilder {
  private worldStateManager: WorldStateManager;
  private memoryStore: MemoryStore;
  private toolRegistry: ToolRegistry;
  private capabilityRegistry: CapabilityRegistry;

  constructor(params: {
    worldStateManager: WorldStateManager;
    memoryStore: MemoryStore;
    toolRegistry: ToolRegistry;
    capabilityRegistry: CapabilityRegistry;
  }) {
    this.worldStateManager = params.worldStateManager;
    this.memoryStore = params.memoryStore;
    this.toolRegistry = params.toolRegistry;
    this.capabilityRegistry = params.capabilityRegistry;
  }

  /**
   * Build cognitive context for a goal
   */
  async build(params: {
    goal: string;
    goalId: string;
    missionState?: MissionStateSnapshot;
  }): Promise<CognitiveContext> {
    const worldState = this.worldStateManager.getState();
    const relevantMemories = await this.retrieveRelevantMemories(params.goal);
    const availableCapabilities = this.getAvailableCapabilities();
    const constraints = worldState.constraints.filter((c) => c.enabled);
    const previousFailures = await this.getPreviousFailures(params.goal);

    return {
      goal: params.goal,
      goalId: params.goalId,
      worldState,
      relevantMemories,
      availableCapabilities,
      constraints,
      previousFailures,
      missionState: params.missionState ?? {
        missionId: '',
        state: 'created',
        taskCount: 0,
        completedTasks: 0,
      },
      timestamp: now().toISOString(),
    };
  }

  /**
   * Retrieve memories relevant to a goal
   */
  private async retrieveRelevantMemories(goal: string): Promise<ContextMemory[]> {
    const records = await this.memoryStore.list({ limit: 100 });
    const scored = records.map((record) => ({
      id: record.id,
      type: record.type,
      content: record.content,
      relevanceScore: this.scoreRelevance(record, goal),
    }));

    return scored
      .filter((m) => m.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }

  private scoreRelevance(record: MemoryRecord, goal: string): number {
    const goalLower = goal.toLowerCase();
    const contentStr = JSON.stringify(record.content).toLowerCase();

    let score = 0;

    // Direct text match
    if (contentStr.includes(goalLower)) score += 0.5;

    // Word overlap
    const goalWords = goalLower.split(/\s+/).filter((w) => w.length > 2);
    for (const word of goalWords) {
      if (contentStr.includes(word)) score += 0.1;
    }

    // Confidence bonus
    score += record.confidence * 0.2;

    // Recency bonus (within last 7 days)
    const age = Date.now() - new Date(record.createdAt).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) score += 0.15;

    // Episodic memory bonus (past experience is valuable)
    if (record.type === 'episodic') score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Get available capabilities (tool IDs that have granted capabilities)
   */
  private getAvailableCapabilities(): string[] {
    const tools = this.toolRegistry.getAllTools();
    return tools
      .filter((t: any) => this.toolRegistry.isToolEnabled(t.id))
      .map((t: any) => t.id);
  }

  /**
   * Get previous failures related to a goal
   */
  private async getPreviousFailures(goal: string): Promise<ContextFailure[]> {
    const records = await this.memoryStore.list({ type: 'episodic', limit: 100 });
    const failures: ContextFailure[] = [];

    for (const record of records) {
      const content = record.content as EpisodicMemoryContent;
      if (content.outcome === 'failure' || content.outcome === 'partial') {
        const goalLower = goal.toLowerCase();
        const missionGoalLower = content.missionGoal.toLowerCase();

        if (
          missionGoalLower.includes(goalLower) ||
          goalLower.includes(missionGoalLower)
        ) {
          failures.push({
            missionId: content.missionId,
            goal: content.missionGoal,
            reason: content.lessonsLearned?.join('; ') ?? 'Unknown',
            timestamp: record.createdAt,
          });
        }
      }
    }

    return failures;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createContextBuilder(params: {
  worldStateManager: WorldStateManager;
  memoryStore: MemoryStore;
  toolRegistry: ToolRegistry;
  capabilityRegistry: CapabilityRegistry;
}): ContextBuilder {
  return new ContextBuilder(params);
}
