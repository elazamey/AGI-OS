// ============================================================================
// AGI OS - CLI entrypoint tests
// ----------------------------------------------------------------------------
// The shipped `agi` binary used to point at a barrel file that never read
// process.argv: it printed nothing and exited 0, so `agi --help` looked like a
// successful no-op. These tests pin the real entrypoint — parsing, rendering,
// and above all the exit codes, which are the only thing a script can rely on.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgv, renderResult, run } from '../src/main.js';

/** Capture what the CLI writes instead of touching the real process streams. */
function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) },
    out: () => out.join('\n'),
    err: () => err.join('\n'),
  };
}

describe('parseArgv', () => {
  it('separates the command from its arguments', () => {
    const a = parseArgv(['mission', 'analyse', 'the', 'repo']);
    expect(a.command).toBe('mission');
    expect(a.rest).toEqual(['analyse', 'the', 'repo']);
    expect(a.usageError).toBeUndefined();
  });

  it('reads flags in any position', () => {
    expect(parseArgv(['--json', 'status']).json).toBe(true);
    expect(parseArgv(['status', '--json']).json).toBe(true);
  });

  it('accepts both --data-dir forms', () => {
    expect(parseArgv(['init', '--data-dir', '/tmp/x']).dataDir).toBe('/tmp/x');
    expect(parseArgv(['init', '--data-dir=/tmp/y']).dataDir).toBe('/tmp/y');
  });

  it('rejects --data-dir with no value', () => {
    expect(parseArgv(['init', '--data-dir']).usageError).toMatch(/requires a value/);
  });

  it('rejects unknown flags rather than ignoring them', () => {
    // Silently ignoring a typo'd flag is how "agi --snubprocess" ends up doing
    // something the operator did not ask for.
    expect(parseArgv(['status', '--nope']).usageError).toMatch(/unknown flag: --nope/);
  });

  it('recognises help and version aliases', () => {
    expect(parseArgv(['-h']).help).toBe(true);
    expect(parseArgv(['--help']).help).toBe(true);
    expect(parseArgv(['-v']).version).toBe(true);
    expect(parseArgv(['--version']).version).toBe(true);
  });
});

describe('renderResult', () => {
  it('renders a failure as an error line', () => {
    expect(renderResult({ success: false, command: 'init', error: 'disk full' })).toBe('error: disk full');
  });

  it('renders init output with the paths it created', () => {
    const text = renderResult({
      success: true,
      command: 'init',
      data: { dataDir: '/d', dbPath: '/d/data/agi_os.db', message: 'ready' },
    });
    expect(text).toContain('ready');
    expect(text).toContain('/d/data/agi_os.db');
  });

  it('renders status without crashing on partial data', () => {
    expect(renderResult({ success: true, command: 'status', data: {} })).toContain('AGI-OS status');
    expect(renderResult({ success: true, command: 'status' })).toContain('AGI-OS status');
  });

  it('tolerates a missing data payload for every command', () => {
    for (const command of ['init', 'status', 'mission', 'help']) {
      expect(() => renderResult({ success: true, command }), command).not.toThrow();
    }
  });

  it('falls back to JSON for commands it does not know', () => {
    const text = renderResult({ success: true, command: 'future', data: { a: 1 } });
    expect(text).toContain('"a": 1');
  });
});

describe('exit codes', () => {
  it('0 for a successful command', async () => {
    const c = capture();
    expect(await run(['help'], c.io)).toBe(0);
  });

  it('0 for --version', async () => {
    const c = capture();
    expect(await run(['--version'], c.io)).toBe(0);
    expect(c.out()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('2 for a usage error', async () => {
    const c = capture();
    expect(await run(['--nope'], c.io)).toBe(2);
    expect(c.err()).toContain('unknown flag');
  });

  it('2 when invoked with no arguments at all', async () => {
    // Printing help is friendly; exiting 0 would tell a script it succeeded.
    const c = capture();
    expect(await run([], c.io)).toBe(2);
    expect(c.out()).toContain('Usage:');
  });

  it('1 for an unknown command', async () => {
    const c = capture();
    expect(await run(['definitely-not-a-command'], c.io)).toBe(1);
    expect(c.out()).toContain('Unknown command');
  });

  it('1 when mission is called without a prompt', async () => {
    const c = capture();
    expect(await run(['mission'], c.io)).toBe(1);
    expect(c.out()).toContain('provide a mission prompt');
  });
});

describe('the commands actually do something', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agi-cli-'));
  });

  it('init creates the data directory and reports the db path', async () => {
    const c = capture();
    const code = await run(['init', '--data-dir', join(dir, 'state')], c.io);
    expect(code).toBe(0);
    expect(existsSync(join(dir, 'state', 'data'))).toBe(true);
    expect(c.out()).toContain(join(dir, 'state', 'data', 'agi_os.db'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('status reports the cost guard as enforced', async () => {
    const c = capture();
    expect(await run(['status'], c.io)).toBe(0);
    expect(c.out()).toContain('cost guard:');
    expect(c.out()).toContain('enforced');
  });

  it('--json emits parseable JSON for the same command', async () => {
    const c = capture();
    expect(await run(['status', '--json'], c.io)).toBe(0);
    const parsed = JSON.parse(c.out());
    expect(parsed.success).toBe(true);
    expect(parsed.command).toBe('status');
    expect(parsed.data.costGuard.enforced).toBe(true);
  });

  it('a mission prompt containing spaces survives argv joining', async () => {
    const c = capture();
    // `agi mission "analyse the repo"` arrives as one argv element; the runner
    // must not split it into separate positional arguments.
    const code = await run(['mission', 'analyse the repo'], c.io);
    expect([0, 1]).toContain(code);
    expect(c.out()).toContain('analyse the repo');
  });
});
