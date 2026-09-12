// ============================================================================
// AGI OS - Missions Package
// Mission Engine - Goal-driven execution with state machine
// ============================================================================

// Types
export type {
  MissionState,
  TaskState,
  TaskPriority,
  Mission,
  Task,
  TaskResult,
  TaskError,
  MissionError,
  MissionEventType,
  MissionEvent,
  TaskExecutor,
  MissionContext,
  MissionConfig
} from './types.js';

export {
  DEFAULT_MISSION_CONFIG,
  MISSION_STATE_TRANSITIONS,
  TASK_STATE_TRANSITIONS,
  InvalidTransitionError
} from './types.js';

// State Machine
export {
  MissionStateMachine,
  TaskStateMachine,
  createMissionStateMachine,
  createTaskStateMachine,
  isValidMissionTransition,
  isValidTaskTransition,
  isMissionTerminal,
  isMissionActive,
  isMissionExecutable,
  isTaskTerminal,
  isTaskActive,
  isTaskExecutable
} from './state-machine.js';

// Task
export {
  createTask,
  TaskManager,
  validateTask,
  serializeTask,
  deserializeTask
} from './task.js';

// Task Graph
export {
  TaskGraph,
  createTaskGraph,
  validateTaskDependencies,
  getExecutionOrder,
  getParallelGroups
} from './task-graph.js';

export type { TaskNode } from './task-graph.js';

// Mission Context & Events
export {
  MissionContextImpl,
  createMissionContext,
  MissionEventStore,
  createMissionEventStore
} from './mission-context.js';

// Mission
export {
  MissionManager,
  MissionRunner,
  createMissionManager,
  createMissionRunner,
  validateMission
} from './mission.js';
