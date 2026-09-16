// ============================================================================
// AGI OS - Event Loop
// The heartbeat: Perceive → Plan → Execute → Reflect → Memorize
// Crash-resistant, safe shutdown, iteration limits
// ============================================================================

import { now } from '@agi-os/kernel';
import type {
  AgentState,
  IterationResult,
  IterationOutcome,
  LoopConfig,
  LoopStats,
  ShutdownReason,
  LoopCallbacks,
} from './types.js';

// ---------------------------------------------------------------------------
// Module Interfaces (minimal contracts for wiring)
// ---------------------------------------------------------------------------
export interface Perceivable {
  perceive(): Promise<{ goal: string; goalId: string; context: Record<string, unknown> } | null>;
}

export interface Plannable {
  plan(params: { goal: string; goalId: string; context: Record<string, unknown> }): Promise<{
    planId: string;
    missionId: string;
    steps: unknown[];
    expectedOutcome: string;
    predictedSuccess: number;
  } | null>;
}

export interface Executable {
  execute(plan: { planId: string; missionId: string; steps: unknown[] }): Promise<{
    missionId: string;
    success: boolean;
    actualOutcome: string;
    duration: number;
    evidenceRefs: string[];
  }>;
}

export interface Reflectable {
  reflect(params: {
    missionId: string;
    goalId: string;
    planId: string;
    predictedSuccess: number;
    expectedOutcome: string;
    actualOutcome: string;
    success: boolean;
    duration: number;
    evidenceRefs: string[];
  }): Promise<{
    lessonsCount: number;
    memoryWrites: unknown[];
  }>;
}

export interface Memorizable {
  memorize(writes: unknown[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Event Loop — the heartbeat of AGI OS
// ---------------------------------------------------------------------------
export class EventLoop {
  private state: AgentState = 'idle';
  private iteration = 0;
  private consecutiveErrors = 0;
  private startTime = 0;
  private stopRequested = false;
  private results: IterationResult[] = [];

  private perceivable: Perceivable;
  private plannable: Plannable;
  private executable: Executable;
  private reflectable: Reflectable;
  private memorizable: Memorizable;

  private config: LoopConfig;
  private callbacks: LoopCallbacks;

  constructor(params: {
    perceivable: Perceivable;
    plannable: Plannable;
    executable: Executable;
    reflectable: Reflectable;
    memorizable: Memorizable;
    config?: Partial<LoopConfig>;
    callbacks?: LoopCallbacks;
  }) {
    this.perceivable = params.perceivable;
    this.plannable = params.plannable;
    this.executable = params.executable;
    this.reflectable = params.reflectable;
    this.memorizable = params.memorizable;
    this.config = { ...DEFAULT_CONFIG, ...params.config };
    this.callbacks = params.callbacks ?? {};
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run the autonomous event loop
   */
  async run(): Promise<LoopStats> {
    this.startTime = Date.now();
    this.state = 'idle';
    this.iteration = 0;
    this.stopRequested = false;
    this.results = [];
    this.consecutiveErrors = 0;

    while (!this.stopRequested && this.iteration < this.config.maxIterations) {
      await this.runIteration();
    }

    const reason: ShutdownReason = this.stopRequested
      ? 'user_request'
      : this.consecutiveErrors >= this.config.maxConsecutiveErrors
        ? 'consecutive_errors'
        : 'max_iterations';

    this.state = 'shutdown';
    this.callbacks.onShutdown?.(reason);

    return this.getStats();
  }

  /**
   * Run a single iteration (public for testing)
   */
  async runIteration(): Promise<IterationResult> {
    const iterStart = Date.now();
    const iterNum = ++this.iteration;

    this.callbacks.onIterationStart?.(iterNum);

    let result: IterationResult;

    try {
      result = await this.executeIteration(iterNum, iterStart);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.consecutiveErrors++;
      this.state = 'error';

      result = {
        iteration: iterNum,
        outcome: 'error',
        goalId: null,
        missionId: null,
        duration: Date.now() - iterStart,
        error: error.message,
        lessonsGenerated: 0,
        timestamp: now().toISOString(),
      };

      this.callbacks.onError?.(error, iterNum);

      // Circuit breaker
      if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        this.stopRequested = true;
      }
    }

    this.results.push(result);
    this.callbacks.onIterationEnd?.(result);

    // Delay between iterations (always yield to event loop for shutdown signals)
    if (result.outcome === 'skipped') {
      await this.delay(Math.max(1, this.config.idleDelayMs));
    } else if (result.outcome === 'error') {
      await this.delay(Math.max(1, this.config.errorBackoffMs));
    } else {
      // Yield to event loop between iterations for shutdown/cancellation
      await new Promise((r) => setTimeout(r, 1));
    }

    return result;
  }

  /**
   * Request graceful shutdown
   */
  shutdown(): void {
    this.stopRequested = true;
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get loop statistics
   */
  getStats(): LoopStats {
    const uptime = Date.now() - this.startTime;
    const durations = this.results.map((r) => r.duration);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      totalIterations: this.results.length,
      successfulIterations: this.results.filter((r) => r.outcome === 'success').length,
      failedIterations: this.results.filter((r) => r.outcome === 'failure').length,
      skippedIterations: this.results.filter((r) => r.outcome === 'skipped').length,
      errorIterations: this.results.filter((r) => r.outcome === 'error').length,
      totalLessonsGenerated: this.results.reduce((sum, r) => sum + r.lessonsGenerated, 0),
      uptime,
      averageIterationDuration: avgDuration,
    };
  }

  /**
   * Get all iteration results
   */
  getResults(): IterationResult[] {
    return [...this.results];
  }

  // -----------------------------------------------------------------------
  // Private — the core pipeline
  // -----------------------------------------------------------------------
  private async executeIteration(iterNum: number, iterStart: number): Promise<IterationResult> {
    // ── 1. PERCEIVE ──────────────────────────────────────────────────────
    this.state = 'perceiving';
    const perception = await this.perceivable.perceive();

    if (!perception) {
      return {
        iteration: iterNum,
        outcome: 'skipped',
        goalId: null,
        missionId: null,
        duration: Date.now() - iterStart,
        error: null,
        lessonsGenerated: 0,
        timestamp: now().toISOString(),
      };
    }

    // ── 2. PLAN ──────────────────────────────────────────────────────────
    this.state = 'planning';
    const plan = await this.plannable.plan({
      goal: perception.goal,
      goalId: perception.goalId,
      context: perception.context,
    });

    if (!plan) {
      return {
        iteration: iterNum,
        outcome: 'skipped',
        goalId: perception.goalId,
        missionId: null,
        duration: Date.now() - iterStart,
        error: 'Planning returned no plan',
        lessonsGenerated: 0,
        timestamp: now().toISOString(),
      };
    }

    // ── 3. EXECUTE ───────────────────────────────────────────────────────
    this.state = 'executing';
    const outcome = await this.executable.execute({
      planId: plan.planId,
      missionId: plan.missionId,
      steps: plan.steps,
    });

    // ── 4. REFLECT ───────────────────────────────────────────────────────
    let lessonsCount = 0;
    let memoryWrites: unknown[] = [];

    if (this.config.enableReflection) {
      this.state = 'reflecting';
      try {
        const reflection = await this.reflectable.reflect({
          missionId: outcome.missionId,
          goalId: perception.goalId,
          planId: plan.planId,
          predictedSuccess: plan.predictedSuccess,
          expectedOutcome: plan.expectedOutcome,
          actualOutcome: outcome.actualOutcome,
          success: outcome.success,
          duration: outcome.duration,
          evidenceRefs: outcome.evidenceRefs,
        });

        lessonsCount = reflection.lessonsCount;
        memoryWrites = reflection.memoryWrites;
      } catch {
        // Reflection failure should not crash the loop
      }
    }

    // ── 5. MEMORIZE ──────────────────────────────────────────────────────
    if (this.config.enableMemoryWrite && memoryWrites.length > 0) {
      this.state = 'memorizing';
      try {
        await this.memorizable.memorize(memoryWrites);
      } catch {
        // Memory write failure should not crash the loop
      }
    }

    // ── DONE ─────────────────────────────────────────────────────────────
    this.state = 'idle';
    this.consecutiveErrors = 0;

    const iterOutcome: IterationOutcome = outcome.success ? 'success' : 'failure';

    return {
      iteration: iterNum,
      outcome: iterOutcome,
      goalId: perception.goalId,
      missionId: outcome.missionId,
      duration: Date.now() - iterStart,
      error: null,
      lessonsGenerated: lessonsCount,
      timestamp: now().toISOString(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG: LoopConfig = {
  maxIterations: 100,
  idleDelayMs: 5000,
  errorBackoffMs: 2000,
  maxConsecutiveErrors: 10,
  enableReflection: true,
  enableMemoryWrite: true,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createEventLoop(params: {
  perceivable: Perceivable;
  plannable: Plannable;
  executable: Executable;
  reflectable: Reflectable;
  memorizable: Memorizable;
  config?: Partial<LoopConfig>;
  callbacks?: LoopCallbacks;
}): EventLoop {
  return new EventLoop(params);
}
