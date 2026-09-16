#!/usr/bin/env node
/**
 * AGI OS — adversarial containment gate
 * ---------------------------------------------------------------------------
 * Runs every hostile payload in @agi-os/sandbox-adversarial against the BUILT
 * sandbox, at every isolation level and against both defence layers:
 *
 *   blocklist   CodeValidator + governance + isolation (the normal caller path)
 *   isolation   the executor alone — the source blocklist is bypassed on purpose,
 *               because a regex list is a convenience, not a boundary
 *
 * The gate fails on ANY escape and on ANY verdict the payload set did not
 * predict. It also fails if the suite cannot detect a deliberate escape: an
 * oracle that is incapable of reporting a breach would make this gate
 * decorative, which is exactly how the previous version of the suite came to
 * report 18/18 "blocked" while executing nothing at all.
 *
 * Usage: node scripts/adversarial-gate.mjs [--isolation vm,subprocess] [--json]
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'packages/sandbox-adversarial/package.json'));

const { AdversarialSuite } = require('@agi-os/sandbox-adversarial');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const isoArg = argv.find((a) => a.startsWith('--isolation'));
const LEVELS = (isoArg ? isoArg.split('=')[1] : 'vm,subprocess').split(',').filter(Boolean);

/** Self-test: the oracle must be able to see a successful attack. */
function selfTest() {
  const suite = new AdversarialSuite({ isolation: 'vm', timeoutMs: 5000 });
  return suite.runAttempt({
    id: 'gate-canary',
    name: 'gate self-test',
    category: 'injection',
    description: 'deliberately succeeds so the gate can prove it is not blind',
    goal: 'print GATE_CANARY_PWNED to stdout',
    payload: 'console.log("GATE_CANARY_PWNED");',
    achieved: (obs) => obs.stdout.includes('GATE_CANARY_PWNED'),
    expected: ['blocked'],
  });
}

const problems = [];
const summary = [];

const canary = await selfTest();
if (canary.actual !== 'escaped') {
  problems.push(
    `ORACLE IS BLIND: a payload that demonstrably succeeded was classified "${canary.actual}". ` +
    'Every other result in this report is therefore meaningless.'
  );
} else if (!asJson) {
  console.log('[adversarial-gate] oracle self-test: a succeeding attack is correctly reported as ESCAPED');
}

for (const isolation of LEVELS) {
  const suite = new AdversarialSuite({ isolation, timeoutMs: 5000, maxMemoryMb: 128 });
  for (const report of await suite.runEveryLayer()) {
    summary.push({
      isolation,
      layer: report.layer,
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      escaped: report.escaped,
      contained: report.contained,
      blocked: report.blocked,
      durationMs: report.durationMs,
    });

    if (!asJson) console.log(suite.formatReport(report));

    if (report.escaped > 0) {
      for (const r of report.results.filter((x) => x.actual === 'escaped')) {
        problems.push(
          `ESCAPE [${isolation}/${report.layer}] ${r.attempt.id} "${r.attempt.name}": ` +
          `goal achieved — ${r.attempt.goal}\n    evidence: ${r.details}`
        );
      }
    }
    for (const r of report.results.filter((x) => !x.passed && x.actual !== 'escaped')) {
      problems.push(
        `UNEXPECTED VERDICT [${isolation}/${report.layer}] ${r.attempt.id}: got "${r.actual}", ` +
        `acceptable were [${r.attempt.expected.join(', ')}]\n    ${r.details}`
      );
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ summary, problems }, null, 2));
} else {
  console.log('');
  for (const row of summary) {
    console.log(
      `[adversarial-gate] ${row.isolation.padEnd(11)} ${row.layer.padEnd(10)} ` +
      `total=${row.total} escaped=${row.escaped} contained=${row.contained} blocked=${row.blocked} ` +
      `unexpected=${row.failed} (${row.durationMs}ms)`
    );
  }
}

if (problems.length > 0) {
  console.error('');
  for (const p of problems) console.error('[adversarial-gate] ' + p);
  console.error(`\n[adversarial-gate] FAILED — ${problems.length} problem(s)`);
  process.exit(1);
}

console.log('[adversarial-gate] PASSED — zero escapes, every verdict as predicted');
