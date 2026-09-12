// ============================================================================
// AGI OS - Orchestrator Package
// Autonomous Event Loop — Perceive→Plan→Execute→Reflect→Memorize
// ============================================================================

// Types
export type {
  AgentState,
  IterationResult,
  IterationOutcome,
  LoopConfig,
  LoopStats,
  ShutdownReason,
  LoopCallbacks,
} from './types.js';

// Module interfaces
export type {
  Perceivable,
  Plannable,
  Executable,
  Reflectable,
  Memorizable,
} from './event-loop.js';

// Event Loop
export { EventLoop, createEventLoop } from './event-loop.js';
