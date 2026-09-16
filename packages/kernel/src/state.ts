// ============================================================================
// AGI OS - State Management
// State revisions, snapshots, and transitions
// ============================================================================

import { generateId, now, hashObject, deepClone } from './utils.js';
import type { State, StateRevision } from './types.js';

/**
 * Create initial state
 */
export function createInitialState(
  data: Record<string, unknown> = {}
): State {
  const timestamp = now();
  const revision = `R${generateId().slice(0, 8)}`;
  
  return {
    revision,
    timestamp,
    data: deepClone(data),
    checksum: hashObject(data)
  };
}

/**
 * Create a state revision (transition)
 */
export function createStateRevision(
  fromState: State,
  toState: State,
  eventId: string,
  delta: Record<string, unknown>
): StateRevision {
  return {
    from: fromState.revision,
    to: toState.revision,
    timestamp: now(),
    delta: deepClone(delta),
    eventId
  };
}

/**
 * Apply changes to state, creating a new revision
 */
export function applyStateChange(
  currentState: State,
  changes: Record<string, unknown>,
  eventId: string
): { state: State; revision: StateRevision } {
  const newData = {
    ...currentState.data,
    ...changes
  };
  
  const newRevision = `R${generateId().slice(0, 8)}`;
  const newState: State = {
    revision: newRevision,
    timestamp: now(),
    data: newData,
    parentRevision: currentState.revision,
    checksum: hashObject(newData)
  };
  
  const delta: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) {
    if (JSON.stringify(currentState.data[key]) !== JSON.stringify(changes[key])) {
      delta[key] = {
        from: currentState.data[key],
        to: changes[key]
      };
    }
  }
  
  const revision = createStateRevision(currentState, newState, eventId, delta);
  
  return { state: newState, revision };
}

/**
 * State manager for tracking state history
 */
export class StateManager {
  private currentState: State;
  private history: StateRevision[] = [];
  private states: Map<string, State> = new Map();

  constructor(initialData: Record<string, unknown> = {}) {
    this.currentState = createInitialState(initialData);
    this.states.set(this.currentState.revision, deepClone(this.currentState));
  }

  /**
   * Get current state
   */
  getCurrentState(): State {
    return deepClone(this.currentState);
  }

  /**
   * Get current revision
   */
  getCurrentRevision(): string {
    return this.currentState.revision;
  }

  /**
   * Apply changes and create new revision
   */
  applyChanges(
    changes: Record<string, unknown>,
    eventId: string
  ): StateRevision {
    const { state, revision } = applyStateChange(
      this.currentState,
      changes,
      eventId
    );
    
    this.currentState = state;
    this.states.set(state.revision, deepClone(state));
    this.history.push(revision);
    
    return revision;
  }

  /**
   * Get state by revision
   */
  getState(revision: string): State | null {
    const state = this.states.get(revision);
    return state ? deepClone(state) : null;
  }

  /**
   * Get state history
   */
  getHistory(): StateRevision[] {
    return deepClone(this.history);
  }

  /**
   * Get history between two revisions (exclusive of the starting point)
   */
  getHistoryBetween(
    fromRevision: string,
    toRevision: string
  ): StateRevision[] {
    const fromIndex = this.history.findIndex(
      (r) => r.from === fromRevision || r.to === fromRevision
    );
    const toIndex = this.history.findIndex(
      (r) => r.from === toRevision || r.to === toRevision
    );
    
    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }
    
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    
    // Exclude the starting point, include the ending point
    return deepClone(this.history.slice(start + 1, end + 1));
  }

  /**
   * Get data at a specific revision
   */
  getDataAtRevision(revision: string): Record<string, unknown> | null {
    const state = this.getState(revision);
    return state ? deepClone(state.data) : null;
  }

  /**
   * Get current data
   */
  getCurrentData<T = Record<string, unknown>>(): T {
    return deepClone(this.currentState.data) as T;
  }

  /**
   * Check if revision exists
   */
  hasRevision(revision: string): boolean {
    return this.states.has(revision);
  }

  /**
   * Get revision count
   */
  revisionCount(): number {
    return this.history.length;
  }

  /**
   * Create a snapshot
   */
  snapshot(): State {
    return deepClone(this.currentState);
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: State): void {
    this.currentState = deepClone(snapshot);
    this.states.set(snapshot.revision, deepClone(snapshot));
  }

  /**
   * Clear history (keep current state)
   */
  clearHistory(): void {
    this.history = [];
  }
}

/**
 * State validator
 */
export function validateState(state: unknown): state is State {
  if (typeof state !== 'object' || state === null) {
    return false;
  }
  
  const s = state as Record<string, unknown>;
  
  return (
    typeof s.revision === 'string' &&
    s.timestamp instanceof Date &&
    typeof s.data === 'object' &&
    s.data !== null &&
    typeof s.checksum === 'string'
  );
}

/**
 * State serializer
 */
export function serializeState(state: State): string {
  return JSON.stringify(state, null, 2);
}

/**
 * State deserializer
 */
export function deserializeState(json: string): State {
  const data = JSON.parse(json);
  return {
    ...data,
    timestamp: new Date(data.timestamp)
  };
}

/**
 * Compare two states and get differences
 */
export function diffStates(
  state1: State,
  state2: State
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([
    ...Object.keys(state1.data),
    ...Object.keys(state2.data)
  ]);
  
  for (const key of allKeys) {
    const val1 = state1.data[key];
    const val2 = state2.data[key];
    
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      diff[key] = { from: val1, to: val2 };
    }
  }
  
  return diff;
}
