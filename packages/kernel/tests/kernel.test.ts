import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Kernel, createKernel } from '../src/index.js';
import type { Event, Evidence } from '../src/types.js';

describe('Kernel', () => {
  let kernel: Kernel;

  beforeEach(() => {
    kernel = createKernel({
      projectId: 'test-project',
      ownerId: 'test-user'
    });
  });

  describe('initialization', () => {
    it('should create kernel with default config', () => {
      const k = createKernel();
      expect(k).toBeDefined();
      expect(k.getConfig().projectId).toBe('default');
    });

    it('should create kernel with custom config', () => {
      expect(kernel.getConfig().projectId).toBe('test-project');
      expect(kernel.getConfig().ownerId).toBe('test-user');
    });

    it('should have all components', () => {
      expect(kernel.getEventBus()).toBeDefined();
      expect(kernel.getEntityStore()).toBeDefined();
      expect(kernel.getEventStore()).toBeDefined();
      expect(kernel.getStateManager()).toBeDefined();
      expect(kernel.getEvidenceStore()).toBeDefined();
      expect(kernel.getDecisionStore()).toBeDefined();
      expect(kernel.getEvidenceVerifier()).toBeDefined();
      expect(kernel.getDecisionAnalyzer()).toBeDefined();
    });
  });

  describe('entity management', () => {
    it('should create entity and record event', async () => {
      const entity = await kernel.createEntity('goal', 'test-source', {
        name: 'Test Goal'
      });

      expect(entity).toBeDefined();
      expect(entity.type).toBe('goal');
      expect(entity.metadata.name).toBe('Test Goal');

      const eventCount = await kernel.getEventCount();
      expect(eventCount).toBe(1);
    });

    it('should create entity with parent', async () => {
      const parent = await kernel.createEntity('mission', 'test-source');
      const child = await kernel.createEntity('task', 'test-source', {}, parent.id);

      expect(child.parentId).toBe(parent.id);
    });

    it('should track entity count', async () => {
      await kernel.createEntity('goal', 'test-source');
      await kernel.createEntity('task', 'test-source');

      const count = await kernel.getEntityCount();
      expect(count).toBe(2);
    });
  });

  describe('event recording', () => {
    it('should record event', async () => {
      const entity = await kernel.createEntity('goal', 'test-source');
      const event = await kernel.recordEvent('goal.updated', entity.id, {
        name: 'Updated Goal'
      });

      expect(event).toBeDefined();
      expect(event.type).toBe('goal.updated');
      expect(event.entityId).toBe(entity.id);
    });

    it('should record event with evidence', async () => {
      const entity = await kernel.createEntity('goal', 'test-source');
      const evidence: Evidence = {
        id: 'ev-1',
        operation: 'test.run',
        exitCode: 0,
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      };

      const event = await kernel.recordEvent('goal.updated', entity.id, {}, evidence);

      expect(event.evidence).toBeDefined();
      expect(event.evidence!.id).toBe('ev-1');
    });

    it('should emit events to bus', async () => {
      const handler = vi.fn();
      kernel.getEventBus().subscribe(handler);

      const entity = await kernel.createEntity('goal', 'test-source');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'goal.created' })
      );
    });
  });

  describe('evidence recording', () => {
    it('should record evidence', async () => {
      const evidence: Evidence = {
        id: 'ev-1',
        operation: 'test.run',
        command: 'pnpm',
        args: ['test'],
        exitCode: 0,
        stdout: 'All tests passed',
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision(),
        duration: 1500
      };

      await kernel.recordEvidence(evidence);

      const stored = await kernel.getEvidenceStore().get('ev-1');
      expect(stored).toBeDefined();
      expect(stored!.operation).toBe('test.run');
    });

    it('should emit evidence event', async () => {
      const handler = vi.fn();
      kernel.getEventBus().subscribe(handler);

      const evidence: Evidence = {
        id: 'ev-1',
        operation: 'test.run',
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      };

      await kernel.recordEvidence(evidence);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'evidence.captured' })
      );
    });
  });

  describe('decision recording', () => {
    it('should record decision', async () => {
      const decision = {
        id: 'dec-1',
        type: 'tool_selection' as const,
        context: 'Which tool to use?',
        options: [
          {
            id: 'opt-1',
            label: 'Option A',
            description: 'Good option',
            risk: 0.2,
            confidence: 0.9,
            predictedOutcome: 'Success'
          }
        ],
        selected: 'opt-1',
        reasoning: 'Option A is better',
        confidence: 0.85,
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      };

      await kernel.recordDecision(decision);

      const stored = await kernel.getDecisionStore().get('dec-1');
      expect(stored).toBeDefined();
      expect(stored!.type).toBe('tool_selection');
    });

    it('should emit decision event', async () => {
      const handler = vi.fn();
      kernel.getEventBus().subscribe(handler);

      const decision = {
        id: 'dec-1',
        type: 'tool_selection' as const,
        context: 'Which tool to use?',
        options: [],
        selected: 'opt-1',
        reasoning: 'Reasoning',
        confidence: 0.85,
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      };

      await kernel.recordDecision(decision);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'decision.made' })
      );
    });
  });

  describe('state management', () => {
    it('should track state revisions', () => {
      const initialRevision = kernel.getStateManager().getCurrentRevision();
      expect(initialRevision).toBeDefined();

      kernel.getStateManager().applyChanges({ count: 1 }, 'event-1');
      kernel.getStateManager().applyChanges({ count: 2 }, 'event-2');

      const count = kernel.getStateRevisionCount();
      expect(count).toBe(2);
    });

    it('should get current state', () => {
      const state = kernel.getCurrentState();
      expect(state).toBeDefined();
      expect(state.data).toHaveProperty('projectId', 'test-project');
    });
  });

  describe('integration workflow', () => {
    it('should handle complete workflow', async () => {
      // 1. Create a mission
      const mission = await kernel.createEntity('mission', 'test-source', {
        name: 'Test Mission'
      });

      // 2. Create a task
      const task = await kernel.createEntity('task', 'test-source', {
        name: 'Test Task'
      }, mission.id);

      // 3. Record task started
      await kernel.recordEvent('task.started', task.id);

      // 4. Record evidence
      const evidence: Evidence = {
        id: 'ev-1',
        operation: 'tool.run',
        exitCode: 0,
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      };
      await kernel.recordEvidence(evidence);

      // 5. Record decision
      await kernel.recordDecision({
        id: 'dec-1',
        type: 'tool_selection',
        context: 'Select tool for task',
        options: [
          {
            id: 'opt-1',
            label: 'Tool A',
            description: 'Best tool',
            risk: 0.1,
            confidence: 0.95,
            predictedOutcome: 'Success'
          }
        ],
        selected: 'opt-1',
        reasoning: 'Tool A is optimal',
        confidence: 0.95,
        timestamp: new Date(),
        stateRevision: kernel.getStateManager().getCurrentRevision()
      });

      // 6. Record task completed
      await kernel.recordEvent('task.completed', task.id);

      // 7. Verify all data exists
      const entityCount = await kernel.getEntityCount();
      expect(entityCount).toBe(2);

      const eventCount = await kernel.getEventCount();
      expect(eventCount).toBeGreaterThanOrEqual(4);

      const evidenceCount = await kernel.getEvidenceStore().count();
      expect(evidenceCount).toBe(1);

      const decisionCount = await kernel.getDecisionStore().count();
      expect(decisionCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      await kernel.createEntity('goal', 'test-source');
      await kernel.recordEvent('goal.updated', 'entity-1');

      kernel.clear();

      expect(await kernel.getEntityCount()).toBe(0);
      expect(await kernel.getEventCount()).toBe(0);
      expect(await kernel.getStateRevisionCount()).toBe(0);
    });
  });
});
