// ============================================================================
// AGI OS - Mission Types
// Types for Mission Engine
// ============================================================================

import type { Evidence } from '@agi-os/kernel';

// ---------------------------------------------------------------------------
// Mission States
// ---------------------------------------------------------------------------
export type MissionState =
  | 'created'
  | 'planning'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'failed'
  | 'verifying'
  | 'completed'
  | 'cancelled';

// ---------------------------------------------------------------------------
// Task States
// ---------------------------------------------------------------------------
export type TaskState =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'cancelled'
  | 'retrying';

// ---------------------------------------------------------------------------
// Task Priority
// ---------------------------------------------------------------------------
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------
export interface Mission {
  id: string;
  goal: string;
  description?: string;
  state: MissionState;
  revision: number;
  tasks: Task[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  error?: MissionError;
  retryCount: number;
  maxRetries: number;
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------
export interface Task {
  id: string;
  missionId: string;
  name: string;
  description?: string;
  state: TaskState;
  priority: TaskPriority;
  dependencies: string[];
  retryCount: number;
  maxRetries: number;
  timeout?: number;
  result?: TaskResult;
  error?: TaskError;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  blockedAt?: Date;
}

// ---------------------------------------------------------------------------
// Task Result
// ---------------------------------------------------------------------------
export interface TaskResult {
  success: boolean;
  data?: unknown;
  output?: string;
  duration: number;
  evidence?: Evidence;
}

// ---------------------------------------------------------------------------
// Task Error
// ---------------------------------------------------------------------------
export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Mission Error
// ---------------------------------------------------------------------------
export interface MissionError {
  code: string;
  message: string;
  taskId?: string;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Mission Event Types
// ---------------------------------------------------------------------------
export type MissionEventType =
  | 'mission.created'
  | 'mission.planning'
  | 'mission.ready'
  | 'mission.started'
  | 'mission.waiting'
  | 'mission.blocked'
  | 'mission.failed'
  | 'mission.completed'
  | 'mission.cancelled'
  | 'mission.retrying'
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.blocked'
  | 'task.cancelled'
  | 'task.retrying';

// ---------------------------------------------------------------------------
// Mission Event
// ---------------------------------------------------------------------------
export interface MissionEvent {
  id: string;
  type: MissionEventType;
  missionId: string;
  taskId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  revision: number;
}

// ---------------------------------------------------------------------------
// Task Executor
// ---------------------------------------------------------------------------
export interface TaskExecutor {
  execute(task: Task, context: MissionContext): Promise<TaskResult>;
  canExecute?(task: Task): boolean;
}

// ---------------------------------------------------------------------------
// Mission Context
// ---------------------------------------------------------------------------
export interface MissionContext {
  missionId: string;
  missionGoal: string;
  tasks: Task[];
  metadata: Record<string, unknown>;
  getState: () => Record<string, unknown>;
  setState: (key: string, value: unknown) => void;
  getTaskResult: (taskId: string) => TaskResult | undefined;
  addEvidence: (evidence: Evidence) => void;
}

// ---------------------------------------------------------------------------
// Mission Config
// ---------------------------------------------------------------------------
export interface MissionConfig {
  maxRetries: number;
  timeout: number;
  maxConcurrentTasks: number;
  requireApproval: boolean;
}

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------
export const DEFAULT_MISSION_CONFIG: MissionConfig = {
  maxRetries: 3,
  timeout: 300000, // 5 minutes
  maxConcurrentTasks: 1,
  requireApproval: false
};

// ---------------------------------------------------------------------------
// State Transition Map
// ---------------------------------------------------------------------------
export const MISSION_STATE_TRANSITIONS: Record<MissionState, MissionState[]> = {
  created: ['planning', 'cancelled'],
  planning: ['ready', 'cancelled'],
  ready: ['running', 'cancelled'],
  running: ['waiting', 'blocked', 'failed', 'verifying', 'cancelled'],
  waiting: ['running', 'blocked', 'failed', 'cancelled'],
  blocked: ['running', 'failed', 'cancelled'],
  failed: ['created', 'cancelled'], // retry goes to created
  verifying: ['completed', 'failed', 'cancelled'],
  completed: [], // terminal state
  cancelled: [] // terminal state
};

// ---------------------------------------------------------------------------
// Task State Transition Map
// ---------------------------------------------------------------------------
export const TASK_STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending: ['ready', 'cancelled'],
  ready: ['running', 'cancelled'],
  running: ['waiting', 'blocked', 'failed', 'completed', 'cancelled'],
  waiting: ['running', 'blocked', 'failed', 'cancelled'],
  blocked: ['running', 'failed', 'cancelled'],
  failed: ['pending', 'retrying', 'cancelled'], // retry goes to pending
  completed: [], // terminal state
  cancelled: [], // terminal state
  retrying: ['pending'] // goes back to pending for retry
};

// ---------------------------------------------------------------------------
// Transition Errors
// ---------------------------------------------------------------------------
export class InvalidTransitionError extends Error {
  constructor(
    public readonly entityType: 'mission' | 'task',
    public readonly entityId: string,
    public readonly fromState: string,
    public readonly toState: string
  ) {
    super(
      `Invalid ${entityType} transition: ${fromState} → ${toState} for ${entityType} ${entityId}`
    );
    this.name = 'InvalidTransitionError';
  }
}
