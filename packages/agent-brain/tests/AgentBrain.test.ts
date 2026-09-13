import { describe, it, expect, vi } from 'vitest';
import { AgentBrain } from '../src/AgentBrain.js';
import type { BrainContext } from '../src/types.js';

describe('AgentBrain', () => {
  const mockProvider = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        action: 'complete',
        reasoning: 'Task completed',
        confidence: 1.0,
      }),
    }),
  } as any;

  const mockRegistry = {
    getEnabledSkills: vi.fn().mockReturnValue([
      { contract: { id: 'fs.read', description: 'Read files' } },
    ]),
  } as any;

  const brain = new AgentBrain({ provider: mockProvider, registry: mockRegistry });

  it('should make decision from LLM response', async () => {
    const context: BrainContext = {
      missionId: 'm1',
      taskId: 't1',
      goal: 'Read file',
      taskDescription: 'Read /tmp/test.txt',
      history: [],
      observations: [],
      workingMemory: {},
    };

    const decision = await brain.decide(context);
    expect(decision.action).toBe('complete');
    expect(mockProvider.complete).toHaveBeenCalled();
  });

  it('should create observation from decision', async () => {
    const decision = { action: 'execute_skill' as const, skillId: 'fs.read', reasoning: 'test', confidence: 0.9 };
    const observation = await brain.observe(decision, { content: 'file data' });

    expect(observation.skillId).toBe('fs.read');
    expect(observation.success).toBe(true);
    expect(observation.evidenceId).toBeDefined();
  });
});
