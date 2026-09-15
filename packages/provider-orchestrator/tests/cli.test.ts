import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { main, parseArgs } from '../src/cli.ts';
import { expandEnv, loadControlPlaneConfig } from '../src/config.ts';
import { startFixture, type Fixture } from './helpers/fixture-server.ts';

const PKG = join(import.meta.dirname, '..');
const CLI = join(PKG, 'src', 'cli.ts');
const REPO = join(PKG, '..', '..');

function cli(...args: string[]) {
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', CLI, ...args], { encoding: 'utf8', cwd: PKG });
  return { code: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

describe('cli', () => {
  it('parses --flag, --flag=value and a leading command', () => {
    assert.deepEqual(parseArgs(['gate', '--live', '--out=/tmp/x', '--strict']), {
      command: 'gate',
      flags: { live: true, out: '/tmp/x', strict: true },
    });
    assert.deepEqual(parseArgs(['--help']), { command: 'help', flags: { help: true } });
    assert.deepEqual(parseArgs([]), { command: 'help', flags: {} });
  });

  it('prints the registry from the repository manifest', () => {
    const run = cli('providers', `--config=${join(REPO, 'agi-os-providers.json')}`);
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /FREE_ONLY: on/);
    assert.match(run.stdout, /model plane \(free-first operating layer\)/);
    assert.match(run.stdout, /openrouter-free\s+free-tier\s+unknown/);
    assert.match(run.stdout, /\$ claude-api\s+paid/, 'a paid entry is printed with a $ so an operator sees it, not hidden');
    assert.match(run.stdout, /local\s+free-tier\s+unknown\s+unlimited-local/);
    assert.match(run.stdout, /✗ cloudflare-ai\s+free-tier/, 'a declared-but-unbound platform shows up as unavailable');
  });

  it('plans a mission and exits non-zero when nothing is eligible', () => {
    const planned = cli('plan', `--config=${join(REPO, 'agi-os-providers.json')}`, '--json', '--prompt=ship the fix');
    assert.equal(planned.code, 0, planned.stderr);
    const decision = JSON.parse(planned.stdout);
    assert.equal(decision.freeOnly, true);
    assert.equal(decision.plane, 'model');
    assert.equal(decision.provider, 'openrouter-free');
    assert.deepEqual(decision.ladder, ['openrouter-free', 'cerebras', 'local', 'gemini-free', 'hf-inference']);
    assert.ok(decision.scores.every((s: { score: number }) => s.score >= 0 && s.score <= 100));
    assert.ok(decision.freeFirst.length >= 5, 'the entitlement decision for every rung is part of the output');
    assert.equal(decision.blockedReason, null);
    assert.ok(!decision.ladder.includes('claude-api'), 'the paid entry in the manifest is not routable');

    const impossible = cli('plan', `--config=${join(REPO, 'agi-os-providers.json')}`, '--capabilities=quantum.tunnel');
    assert.equal(impossible.code, 2, 'no provider is a warning-free outcome: the caller must branch on it');
    assert.match(impossible.stdout, /provider: NONE/);
    assert.match(impossible.stdout, /blocked: NO_ELIGIBLE_PROVIDER/, 'an unanswerable capability is not a quota event, and must not be labelled as one');
  });

  it('prints the score breakdown the ranking was decided on', () => {
    const run = cli('plan', `--config=${join(REPO, 'agi-os-providers.json')}`, '--local');
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /1\. local\s+score\s+\d+\s+qwen2\.5-coder.*unlimited-local ≤ 1/, 'mustBeLocal leaves only the local rung');
  });

  it('refuses to invent a config it cannot read', () => {
    const run = cli('providers', '--config=/nonexistent/agios.json');
    assert.equal(run.code, 2);
    assert.match(run.stderr, /config not found: \/nonexistent\/agios\.json/);
  });

  it('exits 64 on an unknown command instead of doing nothing quietly', () => {
    const run = cli('deplyo', `--config=${join(REPO, 'agi-os-providers.json')}`);
    assert.equal(run.code, 64);
    assert.match(run.stderr, /unknown command: deplyo/);
  });
});

describe('config manifest', () => {
  it('expands ${ENV} with a fallback so secrets stay out of git', () => {
    process.env.AGIOS_TEST_URL = 'https://example.test';
    assert.equal(expandEnv('${AGIOS_TEST_URL}'), 'https://example.test');
    assert.equal(expandEnv('${AGIOS_TEST_UNSET:fallback}'), 'fallback');
    assert.deepEqual(expandEnv({ a: ['${AGIOS_TEST_URL}'], b: { c: '${AGIOS_TEST_URL}/x' } }), { a: ['https://example.test'], b: { c: 'https://example.test/x' } });
    delete process.env.AGIOS_TEST_URL;
    assert.equal(expandEnv('${AGIOS_TEST_URL:http://127.0.0.1:8080/v1}'), 'http://127.0.0.1:8080/v1', 'unset vars fall back to the documented default');
  });

  it('loads the repository manifest into four separated planes', () => {
    const config = loadControlPlaneConfig(join(REPO, 'agi-os-providers.json'));
    assert.equal(config.version, 2);
    assert.deepEqual(config.models.map((m) => m.id), ['openrouter-free', 'gemini-free', 'cerebras', 'hf-inference', 'cloudflare-ai', 'local']);
    assert.deepEqual(config.agents.map((a) => a.id), ['arena', 'codex', 'claude-api', 'manus']);
    assert.deepEqual(config.deployments.map((d) => d.id), ['vercel', 'huggingface', 'cloudflare']);
    assert.deepEqual(config.verifications.map((v) => v.id), ['functional-chain', 'certification']);
    assert.equal(config.deployments.find((d) => d.id === 'vercel')?.mode, 'observe');
    assert.equal(config.deployments.find((d) => d.id === 'cloudflare')?.enabled, false);
    assert.equal(config.verification.probeLive, false, 'CI opts in with --live; local runs must not need the network');
    assert.ok(config.models.every((m) => m.kind === 'model' && m.billing !== 'paid'));
    assert.ok(config.agents.every((a) => a.kind === 'agent'), 'deployment targets are not agents');
    assert.ok(config.deployments.every((d) => !d.url.includes('${')), 'environment indirection is resolved at load time');
  });
});

/**
 * Run the CLI in-process. Its stdout is deliberately not captured: under `node --test`
 * stdout is the reporter's protocol channel, so hijacking it corrupts the run. The
 * assertions below read the artefacts the CLI writes instead — which is also what CI
 * uploads, so the test exercises the real path.
 */
async function runCli(...args: string[]): Promise<number> {
  return main(args);
}

describe('gate command end-to-end (real sockets, real files)', () => {
  let good: Fixture;
  let dead: Fixture;
  let dir: string;
  let providersWritten = 0;

  before(async () => {
    good = await startFixture('conformant');
    dead = await startFixture('frontend-only');
    dir = mkdtempSync(join(tmpdir(), 'agios-cli-'));
  });
  after(async () => {
    // Closing the fixtures matters: an open listener keeps the test process alive
    // after the run, which looks exactly like a passing suite that never finishes.
    await Promise.all([good.close(), dead.close()]);
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(frontendUrl: string, backendUrl: string): string {
    const file = join(dir, `providers-${providersWritten}.json`);
    providersWritten += 1;
    writeFileSync(
      file,
      JSON.stringify({
        version: 2,
        policy: { freeOnly: true },
        agents: [{ id: 'arena', label: 'Arena', capabilities: ['chat'], priority: 10, billing: 'subscription', quota: {}, policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' } }],
        models: [
          { id: 'openrouter-free', capabilities: ['chat'], priority: 10, billing: 'free-tier', freeTier: { basis: 'requests-per-day', limit: 50, hardStop: true }, quota: {}, policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' } },
          { id: 'local', capabilities: ['chat'], priority: 60, billing: 'free-tier', freeTier: { basis: 'unlimited-local', limit: 1, hardStop: true }, quota: {}, policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'local-only' } },
        ],
        deployments: [{ id: 'vercel', mode: 'observe', url: frontendUrl, markers: ['AGI-OS'], backendBaseUrl: backendUrl, enabled: true }],
        verification: { timeoutMs: 2_000, requireContract: true, probeLive: true },
        defaultRequirement: { capabilities: ['chat'] },
      }),
    );
    return file;
  }

  it('VERIFIED when the deployment serves, the chain answers and certification passed', async () => {
    const cert = join(dir, 'cert-pass.json');
    writeFileSync(cert, JSON.stringify({ gate: 'PASSED', runId: 'cli', passed: 66, failed: 0, skipped: 0, assertions: 287 }));
    const out = join(dir, 'pass');
    const code = await runCli('gate', `--config=${writeConfig(good.url, good.url)}`, `--certification=${cert}`, `--out=${out}`, '--strict', '--mission=wrap the deployment as a verified target');
    assert.equal(code, 0);
    const report = readFileSync(join(out, readdirSync(out).find((f) => f.endsWith('.md'))!), 'utf8');
    assert.match(report, /# AGI-OS Deployment Gate — VERIFIED/);
    assert.match(report, /\| verification \| vercel \| VERIFIED \| http=200\/200 · contract=PASS · 7\/7 checks/);
    const evidence = readFileSync(join(out, readdirSync(out).find((f) => f.endsWith('.jsonl'))!), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(
      evidence.map((e) => e.type),
      [
        'run:start',
        'plan:model',
        'plan',
        'observe',
        'verify',
        'verify',
        'verify',
        'verify',
        'verify',
        'verify',
        'verify',
        'verdict',
        'verify:target',
        'certification',
        'run:end',
      ],
      'the ledger is the audit trail: who was chosen under FREE_ONLY, what the platform reported, what each check saw',
    );
    assert.equal(evidence.filter((e) => e.type === 'verify').length, 7, 'one line per verification step, including the ones that passed');
    assert.equal(evidence[2].plane, 'model');
    assert.equal(evidence[2].provider, 'openrouter-free', 'the mission names the provider that ran it');
    assert.equal(evidence[2].freeOnly, true, 'and records that the free-first policy was in force');
    const latest = JSON.parse(readFileSync(join(out, 'gate-latest.json'), 'utf8'));
    assert.equal(latest.status, 'VERIFIED');
    assert.equal(latest.inputs.strict, true);
    assert.equal(latest.inputs.deployments[0].evidence.x_vercel_id, 'iad1::fixture-deploy-0001');
    assert.equal(latest.inputs.verifications[0].summary.deployment, 'VERIFIED');
  });

  it('BLOCKED when a serving UI hides a dead backend, even with a green certification', async () => {
    const cert = join(dir, 'cert-pass2.json');
    writeFileSync(cert, JSON.stringify({ gate: 'PASSED', passed: 66, failed: 0, skipped: 0 }));
    const out = join(dir, 'blocked');
    const code = await runCli('gate', `--config=${writeConfig(dead.url, dead.url)}`, `--certification=${cert}`, `--out=${out}`);
    assert.equal(code, 2, 'a hidden backend breaks the gate: exit 2, not a warning');
    const report = readFileSync(join(out, readdirSync(out).find((f) => f.endsWith('.md'))!), 'utf8');
    assert.match(report, /# AGI-OS Deployment Gate — BLOCKED/);
    assert.match(report, /failed: backend health/);
    const latest = JSON.parse(readFileSync(join(out, 'gate-latest.json'), 'utf8'));
    assert.equal(latest.inputs.deployments[0].status, 'DEPLOYED', 'the deployment itself did succeed — that is precisely the point');
    assert.equal(latest.status, 'BLOCKED');
  });

  it('BLOCKED when the 66-test certification failed on a Ready deployment', async () => {
    const cert = join(dir, 'cert-fail.json');
    writeFileSync(cert, JSON.stringify({ gate: 'BLOCKED', passed: 27, failed: 39, skipped: 0, reason: '12 specs failed on the stub contract' }));
    const out = join(dir, 'certfail');
    const code = await runCli('gate', `--config=${writeConfig(good.url, good.url)}`, `--certification=${cert}`, `--out=${out}`, '--strict');
    assert.equal(code, 2);
    const report = readFileSync(join(out, readdirSync(out).find((f) => f.endsWith('.md'))!), 'utf8');
    assert.match(report, /certification gate=BLOCKED \(27 passed, 39 failed, 0 skipped\)/, 'the failed 66-test run must be visible in the gate report');
    assert.match(report, /\| deployment \| vercel \| DEPLOYED/, 'the deployment itself was fine — that is the whole point');
    assert.match(report, /# AGI-OS Deployment Gate — BLOCKED/);
  });

  it('offline verify degrades instead of pretending, and never touches the network', async () => {
    const out = join(dir, 'offline');
    const code = await runCli('verify', `--config=${join(REPO, 'agi-os-providers.json')}`, `--out=${out}`);
    assert.equal(code, 1, 'no --live → nothing is proven → DEGRADED (exit 1)');
    const written = JSON.parse(readFileSync(join(out, 'verify-latest.json'), 'utf8'));
    assert.equal(written.deployment, 'DEGRADED');
    assert.equal(written.frontend, 'SKIP', 'an unexecuted check is recorded as SKIP, never as PASS');
    assert.deepEqual(written.frontend_http, 0);
    assert.match(written.reasons[0], /not executed, so nothing here is proven/);
  });

  it('live verify against a healthy target reports the verdict json the operator asked for', async () => {
    const out = join(dir, 'verify-out');
    const code = await runCli('verify', `--config=${writeConfig(good.url, good.url)}`, '--live', `--out=${out}`);
    assert.equal(code, 0);
    const written = JSON.parse(readFileSync(join(out, 'verify-latest.json'), 'utf8'));
    assert.deepEqual(
      { frontend: written.frontend, frontend_http: written.frontend_http, backend: written.backend, backend_health: written.backend_health, api_contract: written.api_contract, deployment: written.deployment },
      { frontend: 'PASS', frontend_http: 200, backend: 'PASS', backend_health: 200, api_contract: 'PASS', deployment: 'VERIFIED' },
      'the exact six-key shape the operator specified',
    );
    assert.equal(written.checks.length, 7);
  });
});
