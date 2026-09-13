// ============================================================================
// AGI OS - Isolation Contracts
// ----------------------------------------------------------------------------
// Every executor MUST honour the declared limits. An executor that cannot
// enforce a limit must report it in `unenforced` rather than silently
// pretending — the readiness review found the previous implementation stored
// `timeout` / `memoryLimit` / `networkAccess` and never applied any of them.
// ============================================================================

import type { CodeLanguage } from '../types.js';

/**
 * Isolation strength, weakest first.
 *
 * - `vm`         separate V8 realm inside this process. Blocks host globals,
 *                `eval` and `new Function`, and enforces a CPU timeout.
 *                Does NOT survive a V8 engine exploit and cannot cap RSS.
 * - `worker`     `vm` inside a worker thread with a real heap cap. A crash or
 *                an OOM takes the worker down, not the host.
 * - `subprocess` separate OS process. Node's permission model denies
 *                filesystem access outside the jail and denies spawning
 *                children. Strongest option available without a container.
 */
export type IsolationLevel = 'vm' | 'worker' | 'subprocess';

export interface IsolationRequest {
  code: string;
  language: CodeLanguage;
  timeoutMs: number;
  maxMemoryMb: number;
  networkAccess: boolean;
  filesystemAccess: 'none' | 'readonly' | 'sandboxed';
  /** Only these variables are visible to the guest. Never the host env. */
  env?: Record<string, string>;
  /** Jail root for `subprocess` isolation. */
  jailDir?: string;
}

export interface IsolationResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** True when the guest was killed (timeout, OOM, or policy violation). */
  killed: boolean;
  isolation: IsolationLevel;
  /**
   * Limits this executor could NOT enforce. Surfaced to the caller and to the
   * audit record so a "sandboxed" result is never over-trusted.
   */
  unenforced: string[];
}

export interface IsolatedExecutor {
  readonly level: IsolationLevel;
  execute(request: IsolationRequest): Promise<IsolationResult>;
  /** Human-readable description of what this executor actually guarantees. */
  describe(): string;
}
