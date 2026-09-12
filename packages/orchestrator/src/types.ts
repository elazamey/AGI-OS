// ============================================================================
// AGI OS - Orchestrator Types
// Autonomous Event Loop configuration and results
// ============================================================================

// ---------------------------------------------------------------------------
// Agent State
// ---------------------------------------------------------------------------
export type AgentState = 'idle' | 'perceiving' | 'planning' | 'executing' | 'reflecting' | 'memorizing' | 'error' | 'shutdown';

// ---------------------------------------------------------------------------
// Iteration Result
// ---------------------------------------------------------------------------
export type IterationOutcome = 'success' | 'failure' | 'skipped' | 'error';

export interface IterationResult {
  iteration: number;
  outcome: IterationOutcome;
  goalId: string | null;
  missionId: string | null;
  duration: number;
  error: string | null;
  lessonsGenerated: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Loop Configuration
// ---------------------------------------------------------------------------
export interface LoopConfig {
  maxIterations: number;
  idleDelayMs: number;          // delay when no objectives (default: 5000)
  errorBackoffMs: number;       // delay after error (default: 2000)
  maxConsecutiveErrors: number; // circuit breaker (default: 10)
  enableReflection: boolean;    // enable reflection phase (default: true)
  enableMemoryWrite: boolean;   // enable memory writes (default: true)
}

// ---------------------------------------------------------------------------
// Loop Statistics
// ---------------------------------------------------------------------------
export interface LoopStats {
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  skippedIterations: number;
  errorIterations: number;
  totalLessonsGenerated: number;
  uptime: number;
  averageIterationDuration: number;
}

// ---------------------------------------------------------------------------
// Shutdown Reason
// ---------------------------------------------------------------------------
export type ShutdownReason = 'max_iterations' | 'user_request' | 'consecutive_errors' | 'circuit_breaker';

// ---------------------------------------------------------------------------
// Event Callbacks
// ---------------------------------------------------------------------------
export interface LoopCallbacks {
  onIterationStart?: (iteration: number) => void;
  onIterationEnd?: (result: IterationResult) => void;
  onError?: (error: Error, iteration: number) => void;
  onShutdown?: (reason: ShutdownReason) => void;
  onLessonGenerated?: (lessonId: string, missionId: string) => void;
}
