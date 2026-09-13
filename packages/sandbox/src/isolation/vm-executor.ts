// ============================================================================
// AGI OS - VM Isolation Executor
// ----------------------------------------------------------------------------
// Runs guest code in a separate V8 realm. Three properties make this a real
// boundary rather than the `new Function(code)` it replaces:
//
//  1. `codeGeneration: { strings: false, wasm: false }`
//     `eval` and `new Function` THROW inside the context. This is what kills
//     the escape demonstrated in the readiness review:
//         this.constructor.constructor("return process")().env
//
//  2. No host value is ever handed to the guest.
//     Passing a host function (even a `console.log` shim) would hand the guest
//     a reference whose `.constructor.constructor` is the HOST Function
//     constructor — a full realm escape. Instead a bootstrap script defines
//     `console` *inside* the context and buffers output in a context-local
//     array.
//
//  3. Only primitives cross the boundary.
//     Output is serialised with `JSON.stringify` executed inside the context;
//     the host receives a plain string.
//
// Residual risk (documented, not hidden): `node:vm` is not a security
// mechanism against a V8 engine exploit, and it cannot cap RSS. Use
// SubprocessExecutor for genuinely untrusted code. See docs/SECURITY.md.
// ============================================================================

import { Script, createContext } from 'node:vm';
import type { IsolatedExecutor, IsolationRequest, IsolationResult } from './types.js';

/**
 * Runs inside the fresh realm before any guest code. Defines the guest's
 * `console` and the output buffer without touching the host realm.
 */
const BOOTSTRAP = `
'use strict';
globalThis.__agiOut = [];
globalThis.__agiErr = [];
const __push = (sink) => (...args) => {
  try {
    sink.push(args.map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' '));
  } catch { /* the guest must not be able to break the sink */ }
};
globalThis.console = Object.freeze({
  log: __push(globalThis.__agiOut),
  info: __push(globalThis.__agiOut),
  debug: __push(globalThis.__agiOut),
  warn: __push(globalThis.__agiErr),
  error: __push(globalThis.__agiErr),
});
// Deny the obvious host-reach vectors even before codeGeneration blocks them.
delete globalThis.process;
delete globalThis.require;
delete globalThis.global;
`;

const DRAIN = 'JSON.stringify({ out: globalThis.__agiOut, err: globalThis.__agiErr })';

export class VmExecutor implements IsolatedExecutor {
  readonly level = 'vm' as const;

  async execute(request: IsolationRequest): Promise<IsolationResult> {
    const unenforced: string[] = [];
    if (request.maxMemoryMb > 0) {
      unenforced.push('memoryLimit: a vm realm cannot cap RSS — use subprocess isolation');
    }
    if (request.networkAccess === false) {
      unenforced.push('networkAccess: no socket primitives exist in the realm, but egress is not OS-enforced');
    }

    // `codeGeneration.strings: false` is the load-bearing setting: it makes
    // eval()/new Function() throw inside the context.
    const context = createContext(Object.create(null), {
      codeGeneration: { strings: false, wasm: false },
      name: `agi-sandbox-${Date.now()}`,
    });

    const stderrChunks: string[] = [];

    try {
      new Script(BOOTSTRAP, { filename: 'agi-bootstrap.js' }).runInContext(context, {
        timeout: 5000,
        displayErrors: true,
      });

      const requestedEnv = request.env;
      if (requestedEnv && Object.keys(requestedEnv).length > 0) {
        // Allowlisted environment only — never the host's process.env.
        const names = Object.keys(requestedEnv).filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
        const payload = JSON.stringify(
          Object.fromEntries(names.map((k) => [k, String(requestedEnv[k])]))
        );
        new Script(`globalThis.env = Object.freeze(${payload});`, { filename: 'agi-env.js' })
          .runInContext(context, { timeout: 1000, displayErrors: true });
      }

      const script = new Script(request.code, {
        filename: `guest.${request.language === 'typescript' ? 'ts' : 'js'}`,
      });

      let timedOut = false;
      let guestThrew = false;
      try {
        script.runInContext(context, {
          timeout: Math.max(1, request.timeoutMs),
          displayErrors: true,
          breakOnSigint: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/Script execution timed out/.test(message)) {
          timedOut = true;
          stderrChunks.push(`Execution timed out after ${request.timeoutMs}ms`);
        } else {
          // A throw is a failure even if the guest printed something first.
          guestThrew = true;
          stderrChunks.push(message);
        }
      }

      let out: string[] = [];
      let guestErr: string[] = [];
      try {
        const drained = new Script(DRAIN, { filename: 'agi-drain.js' }).runInContext(context, {
          timeout: 1000,
        });
        if (typeof drained === 'string') {
          const parsed = JSON.parse(drained) as { out?: unknown; err?: unknown };
          out = Array.isArray(parsed.out) ? parsed.out.map(String) : [];
          guestErr = Array.isArray(parsed.err) ? parsed.err.map(String) : [];
        }
      } catch {
        stderrChunks.push('failed to drain guest output buffer');
      }

      return {
        // 124 = timeout (matches GNU timeout), 1 = guest threw, 0 = clean run.
        exitCode: timedOut ? 124 : guestThrew ? 1 : 0,
        stdout: out.join('\n'),
        stderr: [...guestErr, ...stderrChunks].join('\n'),
        timedOut,
        killed: timedOut,
        isolation: this.level,
        unenforced,
      };
    } finally {
      // Release the realm eagerly; contexts are not garbage collected
      // deterministically otherwise.
      try {
        (context as unknown as { __agiOut?: unknown }).__agiOut = undefined;
      } catch { /* ignore */ }
    }
  }

  describe(): string {
    return 'vm realm: separate intrinsics, eval/new Function disabled, CPU timeout enforced, no host globals, primitives-only output';
  }
}
