import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStore, createWorkingMemory } from '../src/index.js';

describe('Working Memory', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let memory: ReturnType<typeof createWorkingMemory>;

  beforeEach(async () => {
    store = createMemoryStore();
    memory = createWorkingMemory(store);
  });

  describe('initialize', () => {
    it('should initialize working memory with a goal', async () => {
      const record = await memory.initialize('mission-1', 'Read file');

      expect(record).toBeDefined();
      expect(record.type).toBe('working');
      expect(record.confidence).toBe(1.0);

      const content = record.content as any;
      expect(content.kind).toBe('working');
      expect(content.currentGoal).toBe('Read file');
      expect(content.currentPlan).toEqual([]);
      expect(content.activeObservations).toEqual([]);
    });
  });

  describe('getActive', () => {
    it('should return null when no active memory', async () => {
      const active = await memory.getActive();
      expect(active).toBeNull();
    });

    it('should return active memory after initialization', async () => {
      await memory.initialize('m1', 'Goal');
      const active = await memory.getActive();
      expect(active).not.toBeNull();
      expect(active!.type).toBe('working');
    });
  });

  describe('setGoal', () => {
    it('should update current goal', async () => {
      await memory.initialize('m1', 'Old goal');
      await memory.setGoal('New goal');
      const goal = await memory.getCurrentGoal();
      expect(goal).toBe('New goal');
    });
  });

  describe('setPlan', () => {
    it('should set plan steps', async () => {
      await memory.initialize('m1', 'Goal');
      await memory.setPlan([
        { description: 'Step 1' },
        { description: 'Step 2', dependsOn: ['step-0'] },
      ]);

      const plan = await memory.getCurrentPlan();
      expect(plan).toHaveLength(2);
      expect(plan[0].description).toBe('Step 1');
      expect(plan[0].status).toBe('pending');
      expect(plan[1].dependsOn).toEqual(['step-0']);
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status', async () => {
      await memory.initialize('m1', 'Goal');
      await memory.setPlan([{ description: 'Do something' }]);
      await memory.updateStepStatus('step-0', 'completed');

      const plan = await memory.getCurrentPlan();
      expect(plan[0].status).toBe('completed');
    });
  });

  describe('addObservation', () => {
    it('should add observation', async () => {
      await memory.initialize('m1', 'Goal');
      const obs = await memory.addObservation({
        source: 'test',
        content: { data: 42 },
      });

      expect(obs).toBeDefined();
      expect(obs.source).toBe('test');
      expect(obs.content).toEqual({ data: 42 });

      const observations = await memory.getObservations();
      expect(observations).toHaveLength(1);
    });
  });

  describe('removeObservation', () => {
    it('should remove observation', async () => {
      await memory.initialize('m1', 'Goal');
      const obs = await memory.addObservation({ source: 'test', content: 'x' });
      const removed = await memory.removeObservation(obs.id);
      expect(removed).toBe(true);

      const observations = await memory.getObservations();
      expect(observations).toHaveLength(0);
    });

    it('should return false for non-existent observation', async () => {
      await memory.initialize('m1', 'Goal');
      const removed = await memory.removeObservation('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('setScratchpad', () => {
    it('should update scratchpad', async () => {
      await memory.initialize('m1', 'Goal');
      await memory.setScratchpad('counter', 0);
      await memory.setScratchpad('counter', 1);

      const active = await memory.getActive();
      const content = active!.content as any;
      expect(content.scratchpad.counter).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should throw when no active memory', async () => {
      await expect(memory.setGoal('x')).rejects.toThrow('No active working memory');
      await expect(memory.setPlan([])).rejects.toThrow('No active working memory');
      await expect(memory.addObservation({ source: 'x', content: '' })).rejects.toThrow('No active working memory');
    });
  });
});
