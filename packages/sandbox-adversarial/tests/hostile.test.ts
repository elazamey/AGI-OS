// ============================================================================
// AGI OS - Hostile PoC Acceptance Suite
// ----------------------------------------------------------------------------
// This is the CI gate named "Run hostile PoC suite (independent of source
// blocklists)". It executes every payload in ESCAPE_ATTEMPTS against the real
// sandbox and requires zero escapes.
//
// Two properties make it meaningful rather than decorative:
//
//   1. It attacks the `isolation` layer, which bypasses the CodeValidator on
//      purpose. A blocklist is a convenience; if containment depended on it,
//      one novel spelling would defeat the whole sandbox.
//   2. It self-tests the detector. A suite that cannot report a breach is
//      worthless — the previous version could not, and passed 18/18 while
//      executing nothing. `the oracle can detect a real escape` below feeds it a
//      payload that genuinely succeeds and requires it to say so.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { AdversarialSuite, ESCAPE_ATTEMPTS, type AdversarialSuiteResult } from '../src/index.js';
import type { EscapeAttempt } from '../src/types.js';
import type { IsolationLevel } from '@agi-os/sandbox';

const LEVELS: IsolationLevel[] = ['vm', 'subprocess'];
const reports = new Map<string, AdversarialSuiteResult>();

beforeAll(async () => {
  // Payloads include an infinite loop; give the suite room but keep it bounded.
  for (const isolation of LEVELS) {
    const suite = new AdversarialSuite({ isolation, timeoutMs: 1500, maxMemoryMb: 64 });
    for (const layer of ['isolation', 'blocklist'] as const) {
      reports.set(`${layer}:${isolation}`, await suite.runAll({ layer }));
    }
  }
}, 180_000);

describe('the detector itself is not tautological', () => {
  it('reports ESCAPED for a payload whose goal it genuinely achieves', async () => {
    // A trivially successful attack: print a marker, and define the goal as
    // "the marker appeared". If the suite says anything other than `escaped`
    // here, its verdicts are worthless and every other assertion is theatre.
    const canary: EscapeAttempt = {
      id: 'canary-escape',
      name: 'self-test canary',
      category: 'injection',
      description: 'deliberately succeeds, to prove the oracle can see success',
      goal: 'print CANARY_PWNED to stdout',
      payload: 'console.log("CANARY_PWNED");',
      achieved: (obs) => obs.stdout.includes('CANARY_PWNED'),
      expected: ['blocked'],
    };

    const result = await new AdversarialSuite({ isolation: 'vm' }).runAttempt(canary);
    expect(result.actual).toBe('escaped');
    expect(result.passed).toBe(false);
    expect(result.observation.ran).toBe(true);
  });

  it('reports BLOCKED when the guest is refused before running', async () => {
    // Python has no executor, so the manager refuses it. That must be a real
    // refusal, never a faked success.
    const suite = new AdversarialSuite({ layer: 'blocklist', isolation: 'vm' });
    const result = await suite.runAttempt({
      id: 'refusal-probe',
      name: 'unsupported language',
      category: 'process',
      description: 'ask for a language with no executor',
      goal: 'have the code executed anyway',
      payload: 'print("hi")',
      language: 'python',
      achieved: (obs) => obs.ran,
      expected: ['blocked'],
    });
    expect(result.actual).toBe('blocked');
    expect(result.observation.ran).toBe(false);
  });
});

describe('no hostile payload escapes the isolation boundary', () => {
  for (const isolation of LEVELS) {
    it(`zero escapes at the isolation layer (${isolation})`, () => {
      const report = reports.get(`isolation:${isolation}`)!;
      expect(report.total).toBe(ESCAPE_ATTEMPTS.length);
      if (report.escaped > 0) {
        // Print the evidence: which goal was achieved and what came back.
        console.error(new AdversarialSuite().formatReport(report));
      }
      expect(report.escaped).toBe(0);
      expect(report.failed).toBe(0);
    });

    it(`zero escapes at the full-stack layer (${isolation})`, () => {
      const report = reports.get(`blocklist:${isolation}`)!;
      expect(report.escaped).toBe(0);
      expect(report.failed).toBe(0);
    });
  }
});

describe('the documented PoCs are dead at the V8 level, not merely filtered', () => {
  const vm = () => reports.get('isolation:vm')!;

  const byId = (id: string) => {
    const found = vm().results.find((r) => r.attempt.id === id);
    if (!found) throw new Error(`missing result for ${id}`);
    return found;
  };

  it('Function-constructor env exfiltration throws instead of leaking', () => {
    const r = byId('esc-priv-01');
    expect(r.actual).not.toBe('escaped');
    // The point of the fix: eval/Function are disabled in the realm, so the
    // failure is an EvalError from V8 — not a blocklist hit.
    expect(r.observation.stderr + r.observation.stdout).toMatch(/EvalError|disallowed|not defined|ReferenceError/);
    expect(r.observation.stdout).not.toMatch(/ENV_LEAK:[1-9]/);
  });

  it('the constructor chain cannot reach the host process object', () => {
    expect(byId('esc-inj-02').observation.stdout).not.toContain('PROCESS:object');
  });

  it('eval and indirect eval are both unavailable', () => {
    expect(byId('esc-inj-01').actual).not.toBe('escaped');
    expect(byId('esc-inj-04').actual).not.toBe('escaped');
  });

  it('the blocklist bypass globalThis["fe"+"tch"] finds nothing', () => {
    // The exact PoC from the readiness review. It must not resolve to a
    // function, whatever the source blocklist says.
    expect(byId('esc-net-01').observation.stdout).not.toContain('SPLIT_FETCH:function');
  });

  it('no host filesystem handle is reachable', () => {
    for (const id of ['esc-fs-01', 'esc-fs-02', 'esc-fs-03', 'esc-fs-04']) {
      expect(byId(id).actual, id).not.toBe('escaped');
    }
  });

  it('no child process can be spawned', () => {
    for (const id of ['esc-proc-02', 'esc-proc-03']) {
      expect(byId(id).actual, id).not.toBe('escaped');
    }
  });

  it('the CPU timeout actually fires on an infinite loop', () => {
    const r = byId('esc-proc-01');
    expect(r.observation.timedOut).toBe(true);
    expect(r.observation.exitCode).toBe(124);
  });

  it('guest prototype pollution does not touch the host realm', () => {
    const r = byId('esc-mem-01');
    // The guest legitimately mutates its OWN Object.prototype, so the payload
    // runs; what must not happen is the host realm changing.
    expect(r.observation.hostPolluted).toBe(false);
    expect((Object.prototype as Record<string, unknown>).agiPolluted).toBeUndefined();
    expect(r.actual).toBe('contained');
  });

  it('no host intrinsics are visible from the guest realm', () => {
    expect(byId('esc-mem-02').observation.stdout).not.toMatch(/HOST_GLOBALS:.+/);
  });
});

describe('honesty about what is not enforced', () => {
  it('vm isolation reports that it cannot cap memory', () => {
    const report = reports.get('isolation:vm')!;
    const any = report.results.find((r) => r.observation.unenforced.length > 0);
    expect(any).toBeDefined();
    expect(any!.observation.unenforced.join(' ')).toMatch(/memory/i);
  });

  it('subprocess isolation reports that network egress needs an OS layer', () => {
    const report = reports.get('isolation:subprocess')!;
    const any = report.results.find((r) => r.observation.unenforced.length > 0);
    expect(any).toBeDefined();
    expect(any!.observation.unenforced.join(' ')).toMatch(/network|egress|permission/i);
  });
});
