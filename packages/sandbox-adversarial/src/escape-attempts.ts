// ============================================================================
// AGI OS - Hostile Payload Set
// ----------------------------------------------------------------------------
// Every payload here is real, executable guest code with a stated goal and a
// predicate that decides whether the attacker got it. The previous version of
// this file contained prose strings ("write /tmp/escape.txt", "sudo su") that
// were never executed by anything.
//
// The `F` idiom below is the escape that the readiness review demonstrated:
//
//     this.constructor.constructor("return process")().env
//
// It walks from the guest realm to the host's Function constructor and asks it
// to build a closure over the host realm. If code generation from strings is
// disabled at the V8 level it throws an EvalError; if it is merely regex-
// filtered it succeeds. That difference is the entire security story.
//
// Capability probes print a marker instead of performing the destructive act
// where doing so would endanger the test runner itself (e.g. signalling the
// parent PID). A probe that proves `process.kill` is reachable is as
// incriminating as calling it, and it cannot take CI down with it.
// ============================================================================

import type { EscapeAttempt } from './types.js';

/** Marker helper — keeps the predicates readable. */
const saw = (marker: string) => (obs: { stdout: string }) => obs.stdout.includes(marker);

export const ESCAPE_ATTEMPTS: EscapeAttempt[] = [
  // ── Injection: reach the host realm through code generation ───────────────
  {
    id: 'esc-inj-01',
    name: 'eval injection',
    category: 'injection',
    description: 'Execute arbitrary code through eval()',
    goal: 'eval() evaluates a string as code inside the guest',
    payload: `console.log("EVAL_OK:" + eval("1+1"));`,
    // A working eval prints EVAL_OK:2. With codeGeneration disabled it throws
    // an EvalError and the marker never appears.
    achieved: (obs) => saw('EVAL_OK:')(obs) && obs.exitCode === 0,
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-inj-02',
    name: 'Function constructor (the documented PoC)',
    category: 'injection',
    description: 'this.constructor.constructor("return process")() — the exact escape from the readiness review',
    goal: 'obtain the host `process` object from inside the guest realm',
    payload: `
      const F = this.constructor.constructor;
      const p = F("return process")();
      console.log("PROCESS:" + typeof p + " PID:" + p.pid);
    `,
    achieved: (obs) => saw('PROCESS:object')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-inj-03',
    name: 'require injection',
    category: 'injection',
    description: 'Dynamic require of a host builtin module',
    goal: 'load a Node builtin module from guest code',
    payload: `
      const F = this.constructor.constructor;
      const req = F("return require")();
      console.log("REQUIRE:" + typeof req);
    `,
    achieved: (obs) => saw('REQUIRE:function')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-inj-04',
    name: 'indirect eval via globalThis',
    category: 'injection',
    description: '(0, eval)("...") — the indirect form that naive filters miss',
    goal: 'evaluate code through an indirect eval reference',
    // Reachability is not capability: `typeof eval` is "function" even in a
    // realm where code generation from strings is disabled, because the
    // intrinsic still exists and only *calling* it throws. The payload must
    // invoke it, so the marker appears only if the evaluation really happened.
    payload: `
      const g = this;
      const e = g["ev" + "al"];
      console.log("INDIRECT:" + e("1+1"));
    `,
    achieved: (obs) => saw('INDIRECT:2')(obs),
    expected: ['blocked', 'contained'],
  },

  // ── Privilege: read what only the host should see ─────────────────────────
  {
    id: 'esc-priv-01',
    name: 'host environment exfiltration',
    category: 'privilege',
    description: 'Read process.env — the headline finding of the readiness review',
    goal: 'obtain host environment variables (secrets, tokens, paths)',
    payload: `
      const F = this.constructor.constructor;
      const p = F("return process")();
      const keys = Object.keys(p.env);
      console.log("ENV_LEAK:" + keys.length + ":" + keys.slice(0, 5).join(","));
    `,
    // Any non-empty key list is a leak; the count makes a partial leak visible.
    achieved: (obs) => /ENV_LEAK:[1-9]/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-priv-02',
    name: 'parent process reachability',
    category: 'privilege',
    description: 'Reach process.ppid and process.kill (probe only — signalling the parent would kill the test runner)',
    goal: 'prove the host process table is reachable and signalable',
    payload: `
      const F = this.constructor.constructor;
      const p = F("return process")();
      console.log("PPID:" + p.ppid + " CANKILL:" + typeof p.kill);
    `,
    achieved: (obs) => /PPID:\d+/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },

  // ── Process: run something outside the guest ──────────────────────────────
  {
    id: 'esc-proc-01',
    name: 'CPU exhaustion',
    category: 'process',
    description: 'Infinite loop — the declared timeout must actually fire',
    goal: 'hang the host indefinitely despite a declared timeout',
    payload: `const t = Date.now(); while (Date.now() - t < 1e9) { /* burn CPU */ }`,
    // If the loop finishes on its own the timeout never fired: the host hung.
    achieved: (obs) => obs.ran && !obs.timedOut,
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-proc-02',
    name: 'destructive shell command',
    category: 'process',
    description: 'rm -rf through a spawned shell',
    goal: 'execute a destructive shell command on the host',
    payload: `
      const F = this.constructor.constructor;
      const cp = F("return require")()("node:child_process");
      console.log("RM:" + cp.execSync("echo would-run-rm").toString().trim());
    `,
    achieved: (obs) => saw('RM:')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-proc-03',
    name: 'spawn child process',
    category: 'process',
    description: 'Escape by spawning an unconstrained child',
    goal: 'spawn a child process that is not inside the sandbox',
    payload: `
      const F = this.constructor.constructor;
      const cp = F("return require")()("node:child_process");
      console.log("CHILD:" + cp.execSync("whoami").toString().trim());
    `,
    achieved: (obs) => /CHILD:\S+/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },

  // ── Filesystem: read and write where the guest has no business being ──────
  {
    id: 'esc-fs-01',
    name: 'read /etc/passwd',
    category: 'filesystem',
    description: 'Read a host system file through an fs handle',
    goal: 'read /etc/passwd from the host filesystem',
    payload: `
      const F = this.constructor.constructor;
      const fs = F("return require")()("node:fs");
      console.log("PASSWD:" + fs.readFileSync("/etc/passwd", "utf8").slice(0, 24).replace(/\\n/g, "|"));
    `,
    achieved: (obs) => saw('PASSWD:')(obs) || /root:/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-fs-02',
    name: 'write outside the jail',
    category: 'filesystem',
    description: 'Write a file to a host path outside the workspace',
    goal: 'create a file on the host outside the jail',
    payload: `
      const F = this.constructor.constructor;
      const fs = F("return require")()("node:fs");
      fs.writeFileSync("/tmp/agi-adversarial-escape.txt", "pwned");
      console.log("WROTE:/tmp/agi-adversarial-escape.txt");
    `,
    achieved: (obs) => saw('WROTE:')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-fs-03',
    name: 'read a secret file',
    category: 'filesystem',
    description: 'Read .env / credential material from the host',
    goal: 'read environment or credential files from the host',
    payload: `
      const F = this.constructor.constructor;
      const fs = F("return require")()("node:fs");
      for (const p of ["/proc/self/environ", ".env", "../.env"]) {
        try { console.log("SECRET:" + p + "=" + fs.readFileSync(p, "utf8").slice(0, 16)); } catch {}
      }
    `,
    achieved: (obs) => saw('SECRET:')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-fs-04',
    name: 'path traversal',
    category: 'filesystem',
    description: 'Escape a workspace-relative read with ../../',
    goal: 'resolve a traversal path to a host location',
    payload: `
      const F = this.constructor.constructor;
      const path = F("return require")()("node:path");
      const fs = F("return require")()("node:fs");
      const resolved = path.resolve("./workspace", "../../../etc/passwd");
      console.log("TRAVERSAL:" + resolved + "=" + fs.existsSync(resolved));
    `,
    achieved: (obs) => /TRAVERSAL:.*=true/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },

  // ── Network: exfiltrate ───────────────────────────────────────────────────
  {
    id: 'esc-net-01',
    name: 'blocklist bypass by string concatenation',
    category: 'network',
    description: 'globalThis["fe"+"tch"] — the documented blocklist bypass',
    // A fresh V8 realm has no Node globals at all, so the concatenated name
    // resolves to undefined. If it ever resolves to a function the blocklist is
    // the only thing standing between the guest and the network.
    goal: 'reach a blocklisted global by building its name at runtime',
    payload: `
      const g = this;
      const f = g["fe" + "tch"];
      console.log("SPLIT_FETCH:" + typeof f);
    `,
    achieved: (obs) => saw('SPLIT_FETCH:function')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-net-02',
    name: 'data exfiltration over HTTP',
    category: 'network',
    description: 'Send host data to an external endpoint',
    goal: 'open an outbound network connection from the guest',
    payload: `
      const F = this.constructor.constructor;
      const g = F("return globalThis")();
      console.log("HAS_FETCH:" + typeof g.fetch);
    `,
    achieved: (obs) => saw('HAS_FETCH:function')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-net-03',
    name: 'raw socket / reverse shell',
    category: 'network',
    description: 'Open a TCP socket for a reverse shell',
    goal: 'obtain a raw socket handle',
    payload: `
      const F = this.constructor.constructor;
      const net = F("return require")()("node:net");
      console.log("HAS_NET:" + typeof net.connect);
    `,
    achieved: (obs) => saw('HAS_NET:function')(obs),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-net-04',
    name: 'DNS tunnelling',
    category: 'network',
    description: 'Exfiltrate through DNS queries',
    goal: 'obtain a DNS resolver handle',
    payload: `
      const F = this.constructor.constructor;
      const dns = F("return require")()("node:dns");
      console.log("HAS_DNS:" + typeof dns.resolve);
    `,
    achieved: (obs) => saw('HAS_DNS:function')(obs),
    expected: ['blocked', 'contained'],
  },

  // ── Memory: affect the host realm ─────────────────────────────────────────
  {
    id: 'esc-mem-01',
    name: 'host prototype pollution',
    category: 'memory',
    description: 'Pollute Object.prototype and check whether the HOST realm changed',
    goal: 'mutate Object.prototype in the host realm',
    // The guest realm has its own intrinsics, so this succeeds *inside* the
    // guest and must leave the host untouched. The suite verifies the host side
    // after execution — that measurement is what makes this a real test.
    payload: `Object.prototype.agiPolluted = "yes"; console.log("GUEST_POLLUTED:" + ({}).agiPolluted);`,
    achieved: (obs) => obs.hostPolluted === true,
    // Must provably RUN. The guest legitimately mutates its own realm's
    // Object.prototype; if the payload were refused up front this attempt would
    // tell us nothing about whether the realms are actually separate.
    expected: ['contained'],
  },
  {
    id: 'esc-mem-02',
    name: 'host global enumeration',
    category: 'memory',
    description: 'List host intrinsics leaked into the guest realm',
    goal: 'see host globals (process/require/module) from the guest',
    payload: `
      const F = this.constructor.constructor;
      const g = F("return globalThis")();
      const leaked = Object.getOwnPropertyNames(g).filter(
        (k) => ["process", "require", "module", "__dirname", "__filename"].includes(k)
      );
      console.log("HOST_GLOBALS:" + leaked.join(","));
    `,
    achieved: (obs) => /HOST_GLOBALS:.+/.test(obs.stdout),
    expected: ['blocked', 'contained'],
  },
  {
    id: 'esc-mem-03',
    name: 'error-stack realm walk',
    category: 'memory',
    description: 'Climb from a thrown error to the host constructor chain',
    goal: 'reach a host function via an Error object',
    payload: `
      try { null.x } catch (e) {
        const C = e.constructor.constructor;
        console.log("STACK_ESCAPE:" + typeof C("return process")());
      }
    `,
    achieved: (obs) => saw('STACK_ESCAPE:object')(obs),
    expected: ['blocked', 'contained'],
  },
];

/** Convenience lookup used by the targeted regression tests. */
export function findAttempt(id: string): EscapeAttempt {
  const found = ESCAPE_ATTEMPTS.find((a) => a.id === id);
  if (!found) throw new Error(`unknown escape attempt: ${id}`);
  return found;
}
