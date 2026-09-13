// ============================================================================
// AGI OS - Subprocess Isolation Executor
// ----------------------------------------------------------------------------
// Strongest isolation available without a container. Guest code runs in a
// separate OS process under Node's Permission Model:
//
//   --permission / --experimental-permission
//   --allow-fs-read=<jail>   --allow-fs-write=<jail>   (nothing else on disk)
//   (no --allow-child-process  → the guest cannot spawn)
//   (no --allow-worker         → the guest cannot open a worker thread)
//   --max-old-space-size=<mb>                          (real heap cap)
//
// Inside that process the guest is additionally run in a `node:vm` realm with
// eval/new Function disabled, so the two mechanisms are independent: an
// escape from one still faces the other.
//
// The host process is killed with SIGKILL when the timeout expires, so an
// infinite loop cannot outlive the request.
// ============================================================================

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IsolatedExecutor, IsolationRequest, IsolationResult } from './types.js';

/** Static harness written into the jail. Contains no guest data. */
const HARNESS = `
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const BOOTSTRAP = \`
'use strict';
globalThis.__out = []; globalThis.__err = [];
const push = (sink) => (...args) => {
  try { sink.push(args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ')); } catch {}
};
globalThis.console = Object.freeze({
  log: push(globalThis.__out), info: push(globalThis.__out), debug: push(globalThis.__out),
  warn: push(globalThis.__err), error: push(globalThis.__err),
});
delete globalThis.process; delete globalThis.require; delete globalThis.global;
\`;

const [guestPath, timeoutMs] = process.argv.slice(2);
const code = readFileSync(guestPath, 'utf8');
const ctx = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
new Script(BOOTSTRAP).runInContext(ctx, { timeout: 5000 });
let timedOut = false;
let failed = false;
try {
  new Script(code, { filename: 'guest.js' }).runInContext(ctx, { timeout: Number(timeoutMs), displayErrors: true });
} catch (err) {
  const m = err && err.message ? err.message : String(err);
  if (/timed out/.test(m)) timedOut = true; else { failed = true; process.stderr.write(m + '\\n'); }
}
try {
  const drained = new Script('JSON.stringify({out: globalThis.__out, err: globalThis.__err})').runInContext(ctx, { timeout: 1000 });
  process.stdout.write(typeof drained === 'string' ? drained : '{"out":[],"err":[]}');
} catch {
  process.stdout.write('{"out":[],"err":[]}');
}
// 124 = timeout (matches GNU timeout), 1 = guest error, 0 = clean run.
process.exitCode = timedOut ? 124 : failed ? 1 : 0;
`;

let permissionFlagCache: string | null | undefined;

/** Probe once which permission flag this Node build accepts. */
function permissionFlag(): Promise<string | null> {
  if (permissionFlagCache !== undefined) return Promise.resolve(permissionFlagCache);
  return new Promise((resolve) => {
    const probe = spawn(process.execPath, ['--permission', '-e', 'process.exit(0)'], { stdio: 'ignore' });
    probe.on('error', () => { permissionFlagCache = null; resolve(null); });
    probe.on('close', (code) => {
      if (code === 0) { permissionFlagCache = '--permission'; resolve(permissionFlagCache); return; }
      const legacy = spawn(process.execPath, ['--experimental-permission', '-e', 'process.exit(0)'], { stdio: 'ignore' });
      legacy.on('error', () => { permissionFlagCache = null; resolve(null); });
      legacy.on('close', (c2) => {
        permissionFlagCache = c2 === 0 ? '--experimental-permission' : null;
        resolve(permissionFlagCache);
      });
    });
  });
}

/**
 * Create (or prepare) the filesystem jail the guest is confined to.
 * `ownJail` marks a jail this call created, so only that caller removes it.
 */
async function resolveJail(requested: string | undefined): Promise<{ jail: string; ownJail: boolean }> {
  if (!requested) {
    return { jail: await mkdtemp(join(tmpdir(), 'agi-sandbox-')), ownJail: true };
  }
  await mkdir(requested, { recursive: true });
  return { jail: requested, ownJail: false };
}

export class SubprocessExecutor implements IsolatedExecutor {
  readonly level = 'subprocess' as const;

  async execute(request: IsolationRequest): Promise<IsolationResult> {
    const unenforced: string[] = [];
    const flag = await permissionFlag();
    if (!flag) {
      unenforced.push('permission model unavailable on this Node build — filesystem jail NOT enforced');
    }
    if (request.networkAccess === false) {
      unenforced.push('networkAccess: Node has no permission-model flag for sockets — egress must be blocked at the container/network layer');
    }

    // Resolved once into a const: reassigning a `let` across an await would let
    // two concurrent executions interleave on the same variable.
    const { jail, ownJail } = await resolveJail(request.jailDir);

    const guestPath = join(jail, 'guest.js');
    const harnessPath = join(jail, 'harness.mjs');

    try {
      await writeFile(guestPath, request.code, 'utf8');
      await writeFile(harnessPath, HARNESS, 'utf8');

      const args: string[] = [];
      if (flag) {
        args.push(flag, `--allow-fs-read=${jail}`, `--allow-fs-write=${jail}`);
      }
      if (request.maxMemoryMb > 0) args.push(`--max-old-space-size=${Math.max(16, request.maxMemoryMb)}`);
      args.push('--no-warnings', harnessPath, guestPath, String(Math.max(1, request.timeoutMs)));

      return await new Promise<IsolationResult>((resolve) => {
        const child = spawn(process.execPath, args, {
          cwd: jail,
          stdio: ['ignore', 'pipe', 'pipe'],
          // Never inherit the host environment: it holds every secret.
          env: {
            PATH: process.env.PATH ?? '/usr/bin:/bin',
            NODE_ENV: 'sandbox',
            ...(request.env ?? {}),
          },
        });

        let stdout = '';
        let stderr = '';
        let killed = false;
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          killed = true;
          child.kill('SIGKILL');
        }, request.timeoutMs + 5000);   // guest timeout fires first; this is the backstop

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            exitCode: 1, stdout: '', stderr: `executor error: ${err.message}`,
            timedOut: false, killed: true, isolation: this.level, unenforced,
          });
        });

        child.on('close', (code, signal) => {
          clearTimeout(timer);
          if (signal === 'SIGKILL' || signal === 'SIGTERM') killed = true;
          // The harness reports its own timeout as exit 124 even when it exits
          // before the wall-clock backstop fires.
          if (code === 124) { timedOut = true; }
          let out = '';
          let guestErr = '';
          try {
            const parsed = JSON.parse(stdout) as { out?: string[]; err?: string[] };
            out = (parsed.out ?? []).join('\n');
            guestErr = (parsed.err ?? []).join('\n');
          } catch {
            // Harness died before draining — surface the raw stream instead of
            // reporting a false success.
            guestErr = stdout.trim();
          }
          if (timedOut) {
            guestErr = (guestErr ? guestErr + '\n' : '') +
              (killed ? 'Killed: wall-clock timeout exceeded' : 'Execution timed out');
          }
          resolve({
            exitCode: timedOut ? 124 : code ?? 1,
            stdout: out,
            stderr: [guestErr, stderr.trim()].filter(Boolean).join('\n'),
            timedOut,
            killed: killed || (signal != null),
            isolation: this.level,
            unenforced,
          });
        });
      });
    } finally {
      if (ownJail && jail) await rm(jail, { recursive: true, force: true });
    }
  }

  describe(): string {
    return 'subprocess: separate OS process, Node permission model filesystem jail, no child-process/worker rights, heap cap, SIGKILL on timeout, vm realm inside';
  }
}
