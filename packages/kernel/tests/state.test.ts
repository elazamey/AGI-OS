import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  createStateRevision,
  applyStateChange,
  StateManager,
  validateState,
  serializeState,
  deserializeState,
  diffStates
} from '../src/state.js';
import type { State } from '../src/types.js';

describe('State', () => {
  describe('createInitialState', () => {
    it('should create initial state with default data', () => {
      const state = createInitialState();

      expect(state).toBeDefined();
      expect(state.revision).toBeDefined();
      expect(state.revision.startsWith('R')).toBe(true);
      expect(state.timestamp).toBeInstanceOf(Date);
      expect(state.data).toEqual({});
      expect(state.checksum).toBeDefined();
    });

    it('should create state with custom data', () => {
      const data = { name: 'Test', count: 42 };
      const state = createInitialState(data);

      expect(state.data).toEqual(data);
    });

    it('should generate unique revisions', () => {
      const state1 = createInitialState();
      const state2 = createInitialState();

      expect(state1.revision).not.toBe(state2.revision);
    });
  });

  describe('applyStateChange', () => {
    it('should apply changes and create new state', () => {
      const initial = createInitialState({ count: 0 });
      const { state: newState, revision } = applyStateChange(
        initial,
        { count: 1 },
        'event-1'
      );

      expect(newState.data.count).toBe(1);
      expect(newState.parentRevision).toBe(initial.revision);
      expect(newState.revision).not.toBe(initial.revision);
      expect(revision.from).toBe(initial.revision);
      expect(revision.to).toBe(newState.revision);
      expect(revision.eventId).toBe('event-1');
    });

    it('should create delta with changes', () => {
      const initial = createInitialState({ a: 1, b: 2 });
      const { revision } = applyStateChange(initial, { b: 3, c: 4 }, 'event-1');

      expect(revision.delta).toHaveProperty('b');
      expect(revision.delta).toHaveProperty('c');
      expect((revision.delta.b as any).from).toBe(2);
      expect((revision.delta.b as any).to).toBe(3);
    });

    it('should not create delta for unchanged values', () => {
      const initial = createInitialState({ a: 1 });
      const { revision } = applyStateChange(initial, { a: 1 }, 'event-1');

      expect(Object.keys(revision.delta)).toHaveLength(0);
    });

    it('should compute new checksum', () => {
      const initial = createInitialState({ count: 0 });
      const { state: newState } = applyStateChange(initial, { count: 1 }, 'event-1');

      expect(newState.checksum).not.toBe(initial.checksum);
    });
  });

  describe('StateManager', () => {
    let manager: StateManager;

    beforeEach(() => {
      manager = new StateManager({ name: 'Test' });
    });

    it('should initialize with default state', () => {
      const state = manager.getCurrentState();
      expect(state.data).toEqual({ name: 'Test' });
    });

    it('should apply changes', () => {
      const revision = manager.applyChanges({ count: 1 }, 'event-1');
      
      expect(revision).toBeDefined();
      expect(revision.from).toBeDefined();
      expect(revision.to).toBeDefined();
    });

    it('should track history', () => {
      manager.applyChanges({ count: 1 }, 'event-1');
      manager.applyChanges({ count: 2 }, 'event-2');
      manager.applyChanges({ count: 3 }, 'event-3');

      const history = manager.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should get state by revision', () => {
      const revision = manager.applyChanges({ count: 1 }, 'event-1');
      const state = manager.getState(revision.to);

      expect(state).toBeDefined();
      expect(state!.data.count).toBe(1);
    });

    it('should return null for non-existent revision', () => {
      const state = manager.getState('R-nonexistent');
      expect(state).toBeNull();
    });

    it('should get history between revisions', () => {
      const rev1 = manager.applyChanges({ count: 1 }, 'event-1');
      const rev2 = manager.applyChanges({ count: 2 }, 'event-2');
      const rev3 = manager.applyChanges({ count: 3 }, 'event-3');

      const history = manager.getHistoryBetween(rev1.to, rev3.to);
      expect(history).toHaveLength(2);
    });

    it('should get data at revision', () => {
      manager.applyChanges({ count: 1 }, 'event-1');
      const revision2 = manager.applyChanges({ count: 2 }, 'event-2');
      manager.applyChanges({ count: 3 }, 'event-3');

      const data = manager.getDataAtRevision(revision2.to);
      expect(data).toEqual({ name: 'Test', count: 2 });
    });

    it('should get current data', () => {
      manager.applyChanges({ count: 1 }, 'event-1');
      const data = manager.getCurrentData<{ name: string; count: number }>();

      expect(data.name).toBe('Test');
      expect(data.count).toBe(1);
    });

    it('should check revision existence', () => {
      const revision = manager.applyChanges({ count: 1 }, 'event-1');
      
      expect(manager.hasRevision(revision.to)).toBe(true);
      expect(manager.hasRevision('R-nonexistent')).toBe(false);
    });

    it('should count revisions', () => {
      expect(manager.revisionCount()).toBe(0);

      manager.applyChanges({ count: 1 }, 'event-1');
      expect(manager.revisionCount()).toBe(1);

      manager.applyChanges({ count: 2 }, 'event-2');
      expect(manager.revisionCount()).toBe(2);
    });

    it('should create and restore snapshot', () => {
      manager.applyChanges({ count: 1 }, 'event-1');
      const snapshot = manager.snapshot();

      manager.applyChanges({ count: 2 }, 'event-2');
      expect(manager.getCurrentData().count).toBe(2);

      manager.restore(snapshot);
      expect(manager.getCurrentData().count).toBe(1);
    });

    it('should clear history', () => {
      manager.applyChanges({ count: 1 }, 'event-1');
      manager.applyChanges({ count: 2 }, 'event-2');

      manager.clearHistory();
      expect(manager.revisionCount()).toBe(0);
    });
  });

  describe('diffStates', () => {
    it('should find differences between states', () => {
      const state1 = createInitialState({ a: 1, b: 2 });
      const state2 = createInitialState({ a: 1, b: 3, c: 4 });

      const diff = diffStates(state1, state2);
      
      expect(diff).toHaveProperty('b');
      expect(diff.b.from).toBe(2);
      expect(diff.b.to).toBe(3);
      expect(diff).toHaveProperty('c');
      expect(diff.c.from).toBeUndefined();
      expect(diff.c.to).toBe(4);
    });

    it('should return empty diff for identical states', () => {
      const state1 = createInitialState({ a: 1 });
      const state2 = createInitialState({ a: 1 });

      const diff = diffStates(state1, state2);
      expect(Object.keys(diff)).toHaveLength(0);
    });
  });

  describe('validateState', () => {
    it('should validate correct state', () => {
      const state = createInitialState({ name: 'Test' });
      expect(validateState(state)).toBe(true);
    });

    it('should reject invalid state', () => {
      expect(validateState(null)).toBe(false);
      expect(validateState({})).toBe(false);
      expect(validateState({ revision: 'R1' })).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip state', () => {
      const state = createInitialState({ name: 'Test', count: 42 });
      const json = serializeState(state);
      const deserialized = deserializeState(json);

      expect(deserialized.revision).toBe(state.revision);
      expect(deserialized.data).toEqual(state.data);
      expect(deserialized.timestamp.getTime()).toBe(state.timestamp.getTime());
    });
  });
});
