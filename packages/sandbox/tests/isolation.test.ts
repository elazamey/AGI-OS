// ============================================================================
// AGI OS - Isolation Regression Suite
// ----------------------------------------------------------------------------
// These are the EXACT payloads that escaped the sandbox in the production
// readiness review of commit 7a60d85. They are deliberately hostile and are
// deliberately independent of `CodeValidator`'s regex blocklist: several of
// them contain no blocklisted token at all and are stopped only by the realm
// boundary itself.
//
// If any of these turns green, the sandbox has regressed to host execution.
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { SandboxManager } from '../src/sandbox-manager.js';
import { VmExecutor } from '../src/isolation/vm-executor.js';
import { SubprocessExecutor } from '../src/isolation/subprocess-executor.js';
import type { IsolationLevel } from '../src/isolation/types.js';

const LEVELS: IsolationLevel[] = ['vm', 'subprocess'];

/**
 * Payloads that must never reach the host. `leakPattern` matches host-derived
 * data (env values, absolute home paths, real PIDs) appearing in guest output.
 */
const HOST_ESCAPES: Array<{ name: string; code: string; leakPattern: RegExp }> = [
  {
    // The original break: `new Function` in the host realm handed the guest
    // the host's `process`. No blocklisted token is present.
    name: 'host process.env via Function constructor chain',
    code: 'console.log(JSON.stringify(this.constructor.constructor("return process")().env))',
    leakPattern: /HOME|PATH|PWD|TOKEN|USER|SHELL/,
  },
  {
    name: 'host globalThis reach-through',
    code: 'console.log(this.constructor.constructor("return globalThis")().process.pid)',
    leakPattern: /\d{2,}/,
  },
  {
    name: 'host realm via a passed-in object (console.log.constructor)',
    code: 'const F = console.log.constructor.constructor; console.log(F("return process")().cwd())',
    leakPattern: /\//,
  },
  {
    name: 'indirect eval to reach the host realm',
    code: 'const e = (0, eval); console.log(JSON.stringify(e("process.env")))',
    leakPattern: /HOME|PATH|TOKEN/,
  },
  {
    name: 'error-stack realm walk',
    code: 'try { null.x } catch (e) { console.log(e.constructor.constructor("return process")().version) }',
    leakPattern: /^v?\d+\./m,
  },
];

describe.each(LEVELS)('Sandbox isolation — %s', (level) => {
  let sm: SandboxManager;

  beforeAll(() => {
    sm = new SandboxManager();
  });

  function newSandbox(overrides?: Record<string, unknown>) {
    return sm.createSandbox({
      isolation: level,
      timeout: 3000,
      memoryLimit: 64,
      networkAccess: false,
      filesystemAccess: 'none',
      allowedModules: [],
      ...overrides,
    } as never);
  }

  describe('host escapes are refused', () => {
    for (const attack of HOST_ESCAPES) {
      it(`blocks: ${attack.name}`, async () => {
        const sb = newSandbox();
        const r = await sm.execute(sb.id, attack.code, 'javascript');

        // The decisive assertion: no host-derived data in guest output.
        expect(r.output).not.toMatch(attack.leakPattern);
        expect(r.success).toBe(false);
        expect(r.execution.exitCode).not.toBe(0);
      });
    }
  });

  describe('declared limits are actually enforced', () => {
    it('runs benign code and captures stdout', async () => {
      const sb = newSandbox();
      const r = await sm.execute(sb.id, 'console.log("benign", 2 + 3)', 'javascript');
      expect(r.success).toBe(true);
      expect(r.output).toContain('benign 5');
      expect(r.execution.exitCode).toBe(0);
    });

    it('enforces the CPU timeout instead of hanging forever', async () => {
      const sb = newSandbox({ timeout: 400 });
      const started = Date.now();
      const r = await sm.execute(sb.id, 'let i = 0; while (true) { i++; }', 'javascript');
      const elapsed = Date.now() - started;

      expect(r.success).toBe(false);
      expect(r.execution.timedOut).toBe(true);
      expect(r.execution.exitCode).toBe(124);
      // Generous upper bound: the point is that it terminates at all.
      expect(elapsed).toBeLessThan(20_000);
    }, 30_000);

    it('reports a guest throw as a failure, not a success', async () => {
      const sb = newSandbox();
      const r = await sm.execute(sb.id, 'throw new Error("boom")', 'javascript');
      expect(r.success).toBe(false);
      expect(r.execution.exitCode).not.toBe(0);
      expect(r.error).toContain('boom');
    });

    it('refuses a language with no executor instead of faking success', async () => {
      const sb = newSandbox();
      const r = await sm.execute(sb.id, 'print("hi")', 'python');
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/Unsupported language/);
      // The old implementation returned `Executed python code` with exit 0.
      expect(r.output).not.toContain('Executed python code');
    });

    it('never leaks the host environment into the guest', async () => {
      const sb = newSandbox();
      const r = await sm.execute(
        sb.id,
        'console.log(JSON.stringify(Object.keys(typeof env === "undefined" ? {} : env)))',
        'javascript'
      );
      expect(r.output).not.toMatch(/HOME|PATH|TOKEN|SHELL/);
    });

    it('records which declared limits the boundary could not enforce', async () => {
      const sb = newSandbox();
      const r = await sm.execute(sb.id, 'console.log("x")', 'javascript');
      expect(Array.isArray(r.execution.unenforcedLimits)).toBe(true);
      expect(r.execution.isolation).toBe(level);
      if (level === 'vm') {
        // A vm realm genuinely cannot cap RSS; that must be visible, not hidden.
        expect(r.execution.unenforcedLimits.join(' ')).toMatch(/memoryLimit/);
      }
    });
  });

  describe('the blocklist is not the only line of defence', () => {
    it('stops a payload containing no blocklisted token', async () => {
      const sb = newSandbox();
      // No `process`, no `eval`, no `new Function`, no `fetch` literal.
      const code = 'const C = this.constructor.constructor; console.log(typeof C)';
      const r = await sm.execute(sb.id, code, 'javascript');
      expect(r.output).not.toMatch(/HOME|TOKEN/);
      expect(r.success).toBe(true);       // typeof is harmless…
      const evil = await sm.execute(sb.id, `${code}; console.log(C("return 1+1")())`, 'javascript');
      expect(evil.success).toBe(false);    // …but calling it is refused by the realm.
    });
  });
});

describe('executor self-description', () => {
  it('vm executor states its guarantees', () => {
    expect(new VmExecutor().describe()).toMatch(/eval\/new Function disabled/);
  });

  it('subprocess executor states its guarantees', () => {
    expect(new SubprocessExecutor().describe()).toMatch(/permission model/);
  });
});
