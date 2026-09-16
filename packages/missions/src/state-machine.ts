// ============================================================================
// AGI OS - Mission State Machine
// Strict state transitions for missions and tasks
// ============================================================================

import {
  type MissionState,
  type TaskState,
  MISSION_STATE_TRANSITIONS,
  TASK_STATE_TRANSITIONS,
  InvalidTransitionError
} from './types.js';

// ---------------------------------------------------------------------------
// Mission State Machine
// ---------------------------------------------------------------------------
export class MissionStateMachine {
  private state: MissionState;
  private history: Array<{
    from: MissionState;
    to: MissionState;
    timestamp: Date;
  }> = [];

  constructor(initialState: MissionState = 'created') {
    this.state = initialState;
  }

  /**
   * Get current state
   */
  getState(): MissionState {
    return this.state;
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: MissionState): boolean {
    const allowed = MISSION_STATE_TRANSITIONS[this.state];
    return allowed.includes(to);
  }

  /**
   * Get allowed transitions from current state
   */
  getAllowedTransitions(): MissionState[] {
    return MISSION_STATE_TRANSITIONS[this.state];
  }

  /**
   * Transition to new state
   * @throws InvalidTransitionError if transition is not allowed
   */
  transition(to: MissionState): void {
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(
        'mission',
        '',
        this.state,
        to
      );
    }

    this.history.push({
      from: this.state,
      to,
      timestamp: new Date()
    });

    this.state = to;
  }

  /**
   * Try transition, returns true if successful
   */
  tryTransition(to: MissionState): boolean {
    try {
      this.transition(to);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transition history
   */
  getHistory(): Array<{
    from: MissionState;
    to: MissionState;
    timestamp: Date;
  }> {
    return [...this.history];
  }

  /**
   * Check if mission is in terminal state
   */
  isTerminal(): boolean {
    return this.state === 'completed' || this.state === 'cancelled';
  }

  /**
   * Check if mission is active
   */
  isActive(): boolean {
    return !this.isTerminal() && this.state !== 'failed';
  }

  /**
   * Check if mission can be executed
   */
  isExecutable(): boolean {
    return this.state === 'running' || this.state === 'waiting' || this.state === 'blocked';
  }

  /**
   * Reset state machine (for retry)
   */
  reset(): void {
    this.history.push({
      from: this.state,
      to: 'created',
      timestamp: new Date()
    });
    this.state = 'created';
  }

  /**
   * Get duration since state change
   */
  getTimeInState(): number {
    if (this.history.length === 0) {
      return Date.now() - Date.now(); // Just created
    }
    const lastTransition = this.history[this.history.length - 1];
    return Date.now() - lastTransition.timestamp.getTime();
  }
}

// ---------------------------------------------------------------------------
// Task State Machine
// ---------------------------------------------------------------------------
export class TaskStateMachine {
  private state: TaskState;
  private history: Array<{
    from: TaskState;
    to: TaskState;
    timestamp: Date;
  }> = [];

  constructor(initialState: TaskState = 'pending') {
    this.state = initialState;
  }

  /**
   * Get current state
   */
  getState(): TaskState {
    return this.state;
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: TaskState): boolean {
    const allowed = TASK_STATE_TRANSITIONS[this.state];
    return allowed.includes(to);
  }

  /**
   * Get allowed transitions from current state
   */
  getAllowedTransitions(): TaskState[] {
    return TASK_STATE_TRANSITIONS[this.state];
  }

  /**
   * Transition to new state
   * @throws InvalidTransitionError if transition is not allowed
   */
  transition(to: TaskState): void {
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(
        'task',
        '',
        this.state,
        to
      );
    }

    this.history.push({
      from: this.state,
      to,
      timestamp: new Date()
    });

    this.state = to;
  }

  /**
   * Try transition, returns true if successful
   */
  tryTransition(to: TaskState): boolean {
    try {
      this.transition(to);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transition history
   */
  getHistory(): Array<{
    from: TaskState;
    to: TaskState;
    timestamp: Date;
  }> {
    return [...this.history];
  }

  /**
   * Check if task is in terminal state
   */
  isTerminal(): boolean {
    return this.state === 'completed' || this.state === 'cancelled';
  }

  /**
   * Check if task is active
   */
  isActive(): boolean {
    return !this.isTerminal() && this.state !== 'failed';
  }

  /**
   * Check if task can be executed
   */
  isExecutable(): boolean {
    return this.state === 'ready' || this.state === 'running';
  }

  /**
   * Check if task needs retry
   */
  needsRetry(): boolean {
    return this.state === 'failed' || this.state === 'retrying';
  }

  /**
   * Reset state machine (for retry)
   */
  reset(): void {
    this.history.push({
      from: this.state,
      to: 'pending',
      timestamp: new Date()
    });
    this.state = 'pending';
  }

  /**
   * Get duration since state change
   */
  getTimeInState(): number {
    if (this.history.length === 0) {
      return Date.now() - Date.now();
    }
    const lastTransition = this.history[this.history.length - 1];
    return Date.now() - lastTransition.timestamp.getTime();
  }
}

// ---------------------------------------------------------------------------
// State Machine Factory
// ---------------------------------------------------------------------------
export function createMissionStateMachine(
  initialState: MissionState = 'created'
): MissionStateMachine {
  return new MissionStateMachine(initialState);
}

export function createTaskStateMachine(
  initialState: TaskState = 'pending'
): TaskStateMachine {
  return new TaskStateMachine(initialState);
}

// ---------------------------------------------------------------------------
// State Validation
// ---------------------------------------------------------------------------
export function isValidMissionTransition(
  from: MissionState,
  to: MissionState
): boolean {
  return MISSION_STATE_TRANSITIONS[from].includes(to);
}

export function isValidTaskTransition(
  from: TaskState,
  to: TaskState
): boolean {
  return TASK_STATE_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// State Helpers
// ---------------------------------------------------------------------------
export function isMissionTerminal(state: MissionState): boolean {
  return state === 'completed' || state === 'cancelled';
}

export function isMissionActive(state: MissionState): boolean {
  return !isMissionTerminal(state) && state !== 'failed';
}

export function isMissionExecutable(state: MissionState): boolean {
  return state === 'running' || state === 'waiting' || state === 'blocked';
}

export function isTaskTerminal(state: TaskState): boolean {
  return state === 'completed' || state === 'cancelled';
}

export function isTaskActive(state: TaskState): boolean {
  return !isTaskTerminal(state) && state !== 'failed';
}

export function isTaskExecutable(state: TaskState): boolean {
  return state === 'ready' || state === 'running';
}
