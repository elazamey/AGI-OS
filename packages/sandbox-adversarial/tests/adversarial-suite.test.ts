// ============================================================================
// AGI OS - AdversarialSuite API and integrity tests
// ----------------------------------------------------------------------------
// `hostile.test.ts` is the acceptance gate; this file covers the suite's own
// contract, including the regression that matters most: the previous suite
// classified every attempt as blocked without executing anything, because
// SandboxEnforcer.checkCapability had no `*.execute` key and therefore always
// denied. These tests pin the oracle's behaviour so that mistake cannot return.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { AdversarialSuite, SandboxEnforcer, ESCAPE_ATTEMPTS, findAttempt } from '../src/index.js';
import type { EscapeAttempt, Observation } from '../src/types.js';

/** A payload that succeeds, with a goal that its success satisfies. */
const WINNING: EscapeAttempt = {
  id: 'unit-win',
  name: 'succeeds on purpose',
  category: 'injection',
  description: 'prints its marker',
  goal: 'print MARKER',
  payload: 'console.log("MARKER");',
  achieved: (obs) => obs.stdout.includes('MARKER'),
  expected: ['blocked'],
};

/** A payload that runs but does not achieve its (impossible) goal. */
const CONTAINED: EscapeAttempt = {
  id: 'unit-contained',
  name: 'runs but achieves nothing',
  category: 'memory',
  description: 'computes locally',
  goal: 'reach the host realm',
  payload: 'const x = 1 + 1; console.log("LOCAL:" + x);',
  achieved: (obs) => obs.stdout.includes('HOST_REACHED'),
  expected: ['contained'],
};

const observation = (over: Partial<Observation> = {}): Observation => ({
  ran: true,
  exitCode: 0,
  stdout: '',
  stderr: '',
  timedOut: false,
  killed: false,
  unenforced: [],
  ...over,
});

describe('payload set integrity', () => {
  it('every payload is executable code, not prose', () => {
    // The old set contained strings like "write /tmp/escape.txt" and "sudo su",
    // which no interpreter could ever run. Require real code shape.
    for (const a of ESCAPE_ATTEMPTS) {
      expect(a.payload.length, a.id).toBeGreaterThan(10);
      expect(/[;{}()]/.test(a.payload), `${a.id} does not look like code`).toBe(true);
      expect(/\b(write|sudo|ln -s)\b\s*$/.test(a.payload.trim()), `${a.id} looks like prose`).toBe(false);
    }
  });

  it('every attempt states a goal a human can judge', () => {
    for (const a of ESCAPE_ATTEMPTS) {
      expect(a.goal.length, a.id).toBeGreaterThan(12);
      expect(typeof a.achieved).toBe('function');
    }
  });

  it('covers every attack category from the readiness review', () => {
    const categories = new Set(ESCAPE_ATTEMPTS.map((a) => a.category));
    for (const c of ['filesystem', 'process', 'network', 'memory', 'injection', 'privilege']) {
      expect(categories.has(c as never), `missing category ${c}`).toBe(true);
    }
  });

  it('ids are unique and findable', () => {
    const ids = ESCAPE_ATTEMPTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findAttempt('esc-inj-02').name).toContain('Function constructor');
    expect(() => findAttempt('nope')).toThrow(/unknown escape attempt/);
  });

  it('the documented PoCs are present', () => {
    // These two are the specific findings the review reproduced by hand.
    expect(findAttempt('esc-inj-02').payload).toContain('this.constructor.constructor');
    expect(findAttempt('esc-net-01').payload).toContain('"fe" + "tch"');
  });
});

describe('verdict oracle', () => {
  it('calls ESCAPED when the goal was achieved', async () => {
    const r = await new AdversarialSuite({ isolation: 'vm' }).runAttempt(WINNING);
    expect(r.actual).toBe('escaped');
    expect(r.passed).toBe(false);
  });

  it('calls CONTAINED when the guest ran but the goal was not achieved', async () => {
    const r = await new AdversarialSuite({ isolation: 'vm' }).runAttempt(CONTAINED);
    expect(r.actual).toBe('contained');
    expect(r.passed).toBe(true);
  });

  it('calls BLOCKED when the guest never ran', async () => {
    // Synthesise a refusal through the blocklist layer using a language with no
    // executor, which SandboxManager refuses outright.
    const suite = new AdversarialSuite({ layer: 'blocklist', isolation: 'vm' });
    const r = await suite.runAttempt({
      ...CONTAINED,
      id: 'unit-refused',
      payload: 'print(1)',
      // Python has no executor; without declaring the language this payload is
      // merely odd-looking JavaScript and would legitimately run.
      language: 'python',
      achieved: (obs) => obs.ran,
    });
    // `achieved` is "did it run"; a refusal means ran=false → not achieved.
    expect(r.observation.ran).toBe(false);
    expect(r.actual).toBe('blocked');
  });

  it('a broken oracle is reported as a failure, never laundered into a pass', async () => {
    const suite = new AdversarialSuite({ isolation: 'vm' });
    const broken: EscapeAttempt = {
      ...WINNING,
      id: 'unit-broken-oracle',
      achieved: () => {
        throw new Error('oracle exploded');
      },
    };
    const r = await suite.runAttempt(broken);
    expect(r.passed).toBe(false);
    expect(r.observation.harnessError).toMatch(/verdict predicate threw: oracle exploded/);
    // Conservative direction: an unverifiable attempt counts as an escape, so it
    // can never silently become a green build.
    expect(r.actual).toBe('escaped');
  });

  it('pure predicate logic is deterministic', () => {
    const a = findAttempt('esc-priv-01');
    expect(a.achieved(observation({ stdout: 'ENV_LEAK:0:' }))).toBe(false);
    expect(a.achieved(observation({ stdout: 'ENV_LEAK:42:PATH,HOME' }))).toBe(true);

    const cpu = findAttempt('esc-proc-01');
    expect(cpu.achieved(observation({ ran: true, timedOut: true }))).toBe(false);
    expect(cpu.achieved(observation({ ran: true, timedOut: false }))).toBe(true);
    expect(cpu.achieved(observation({ ran: false, timedOut: false }))).toBe(false);

    const pollute = findAttempt('esc-mem-01');
    expect(pollute.achieved(observation({ hostPolluted: false }))).toBe(false);
    expect(pollute.achieved(observation({ hostPolluted: true }))).toBe(true);
  });
});

describe('reporting', () => {
  it('summarises counts and keeps per-attempt evidence', async () => {
    const suite = new AdversarialSuite({ isolation: 'vm', attempts: [WINNING, CONTAINED] });
    const report = await suite.runAll();

    expect(report.total).toBe(2);
    expect(report.passed + report.failed).toBe(2);
    expect(report.escaped).toBe(1);
    expect(report.contained).toBe(1);
    expect(report.blocked).toBe(0);
    expect(report.layer).toBe('isolation');
    expect(report.isolation).toBe('vm');
    expect(report.timestamp).toBeTruthy();
    expect(report.results).toHaveLength(2);
  });

  it('getBreaches returns exactly the escapes', async () => {
    const suite = new AdversarialSuite({ isolation: 'vm', attempts: [WINNING, CONTAINED] });
    await suite.runAll();
    const breaches = suite.getBreaches();
    expect(breaches).toHaveLength(1);
    expect(breaches[0].attempt.id).toBe('unit-win');
  });

  it('the report names the goal that was achieved', async () => {
    const suite = new AdversarialSuite({ isolation: 'vm', attempts: [WINNING] });
    const report = await suite.runAll();
    const text = suite.formatReport(report);
    expect(text).toContain('FAIL');
    expect(text).toContain('print MARKER');
    expect(text).toContain('escaped=1');
  });

  it('runEveryLayer attacks both the blocklist and the isolation layer', async () => {
    const suite = new AdversarialSuite({ isolation: 'vm', attempts: [CONTAINED] });
    const reports = await suite.runEveryLayer();
    expect(reports.map((r) => r.layer)).toEqual(['blocklist', 'isolation']);
    for (const r of reports) expect(r.escaped).toBe(0);
  });
});

describe('SandboxEnforcer is a policy descriptor, not an oracle', () => {
  it('declares the *.execute capabilities the suite probes', () => {
    const e = new SandboxEnforcer();
    for (const cap of ['filesystem.execute', 'network.execute', 'exec.execute', 'injection.execute']) {
      const r = e.checkCapability(cap);
      expect(r.allowed).toBe(false);
      // The regression: these used to fall through to "Unknown capability",
      // which is why every verdict was decided before any code ran.
      expect(r.reason, cap).not.toMatch(/Unknown capability/);
    }
  });

  it('still denies genuinely unknown capabilities', () => {
    expect(new SandboxEnforcer().checkCapability('made.up').allowed).toBe(false);
  });

  it('detects path traversal and out-of-root access', () => {
    const e = new SandboxEnforcer({ filesystemRoot: '/sandbox' });
    expect(e.checkPath('/sandbox/a.txt').allowed).toBe(true);
    expect(e.checkPath('/sandbox/../etc/passwd').allowed).toBe(false);
    expect(e.checkPath('/etc/passwd').allowed).toBe(false);
  });

  it('enforces module allow/deny lists', () => {
    const e = new SandboxEnforcer();
    expect(e.checkModule('child_process').allowed).toBe(false);
    expect(e.checkModule('fs').allowed).toBe(true);
    expect(e.checkModule('net').allowed).toBe(false);
  });

  it('enforces declared resource limits', () => {
    const e = new SandboxEnforcer({ maxMemoryBytes: 1024, maxCpuTimeMs: 10 });
    expect(e.checkMemoryUsage(2048).allowed).toBe(false);
    expect(e.checkMemoryUsage(512).allowed).toBe(true);
    expect(e.checkCpuTime(11).allowed).toBe(false);
    expect(e.checkCpuTime(5).allowed).toBe(true);
  });
});
