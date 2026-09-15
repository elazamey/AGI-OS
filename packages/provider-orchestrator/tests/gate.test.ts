import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateGate, renderGateReport } from '../src/gate.ts';
import { verifyDeployment } from '../src/verification.ts';
import { huggingFaceTarget, unboundTarget, vercelProductionTarget, type ObserveResult } from '../src/deployment.ts';
import { startFixture, type Fixture } from './helpers/fixture-server.ts';
import type { GateStatus, VerificationVerdict } from '../src/types.ts';

function verdict(deployment: GateStatus, checks: VerificationVerdict['checks'] = []): VerificationVerdict {
  return {
    frontend: 'PASS', frontend_http: 200, backend: 'PASS', backend_health: 200, api_contract: 'PASS',
    deployment, checks, durationMs: 12, reasons: deployment === 'VERIFIED' ? [] : [`${deployment} by missing evidence`],
  };
}

const deployed: ObserveResult = {
  provider: 'vercel', deploymentId: 'iad1::abc123', url: 'https://agi-os-workspace-ui.vercel.app',
  status: 'DEPLOYED', platformState: 'served 200',
  evidence: { http_status: 200, deploy_owner: 'vercel-git-integration (main auto-deploy)' },
};

const PASSED = { gate: 'PASSED' as const, runId: 'r1', passed: 66, failed: 0, skipped: 0, assertions: 287 };

describe('gate: DEPLOYED ≠ VERIFIED', () => {
  it('needs all three planes to agree before it says VERIFIED', () => {
    const decision = evaluateGate({
      deployments: [deployed],
      verifications: [{ target: 'vercel', verdict: verdict('VERIFIED', [{ label: 'chat contract', ok: true }]) }],
      certification: PASSED,
    });
    assert.equal(decision.status, 'VERIFIED');
    assert.deepEqual(decision.reasons, []);
    assert.equal(decision.exitCode, 0);
  });

  it('blocks a Ready deployment whose certification failed — the case that started this', () => {
    const decision = evaluateGate({
      deployments: [deployed],
      verifications: [{ target: 'vercel', verdict: verdict('VERIFIED') }],
      certification: { gate: 'BLOCKED', runId: 'r2', passed: 27, failed: 39, skipped: 0, reason: 'chat contract: stub content detected' },
    });
    assert.equal(decision.status, 'BLOCKED', 'Deploy=Ready + Certification=FAIL must never read as shipped-and-safe');
    assert.equal(decision.exitCode, 2);
    assert.match(decision.reasons.join('\n'), /certification gate=BLOCKED \(27 passed, 39 failed/);
    const report = renderGateReport(decision);
    assert.match(report, /# AGI-OS Deployment Gate — BLOCKED/);
    assert.match(report, /\| deployment \| vercel \| DEPLOYED \| served 200 \(`iad1::abc123`\)/, 'the report names the build it judged');
    assert.match(report, /\| certification \| tests\/production \| BLOCKED \| 27 passed · 39 failed · 0 skipped/);
  });

  it('blocks when the platform is happy but the functional chain is not', async () => {
    const offline = await startFixture('frontend-only');
    try {
      const live = await verifyDeployment({ frontendUrl: offline.url, backendBaseUrl: offline.url });
      const decision = evaluateGate({
        deployments: [{ provider: 'vercel', deploymentId: 'x', url: offline.url, status: 'DEPLOYED', platformState: 'served 200', evidence: {} }],
        verifications: [{ target: 'vercel', verdict: live }],
        certification: PASSED,
      });
      assert.equal(decision.status, 'BLOCKED');
      assert.match(decision.reasons.join('\n'), /vercel: functional verification BLOCKED — failed: backend health, models list, chat contract/);
    } finally {
      await offline.close();
    }
  });

  it('treats missing evidence as blocking, not as passing', () => {
    const noCert = evaluateGate({ deployments: [deployed], verifications: [{ target: 'vercel', verdict: verdict('VERIFIED') }], certification: null });
    assert.equal(noCert.status, 'BLOCKED');
    assert.match(noCert.reasons.join('\n'), /certification \(tests\/production\) has no result/);

    const noVerify = evaluateGate({ deployments: [deployed], verifications: [], certification: PASSED });
    assert.equal(noVerify.status, 'BLOCKED');
    assert.match(noVerify.reasons.join('\n'), /a deployment id without a probe proves nothing/);

    const nothing = evaluateGate({ deployments: [], verifications: [], certification: PASSED });
    assert.equal(nothing.status, 'BLOCKED');
    assert.match(nothing.reasons.join('\n'), /no deployment target was observed/);
  });

  it('degrades — without claiming an outage — when a step could not be evaluated', () => {
    const decision = evaluateGate({
      deployments: [deployed],
      verifications: [{ target: 'vercel', verdict: verdict('DEGRADED', [{ label: 'models list', ok: true, skipped: true }]) }],
      certification: PASSED,
    });
    assert.equal(decision.status, 'DEGRADED');
    assert.equal(decision.exitCode, 1, 'a warning that CI can fail on under --strict, but that is not an outage');
    assert.match(decision.reasons.join('\n'), /vercel: functional verification DEGRADED — unproven: models list/);

    const strict = evaluateGate({
      deployments: [deployed],
      verifications: [{ target: 'vercel', verdict: verdict('DEGRADED', [{ label: 'models list', ok: true, skipped: true }]) }],
      certification: PASSED,
      strict: true,
    });
    assert.equal(strict.status, 'DEGRADED');
    assert.equal(strict.exitCode, 2, 'strict mode withholds the green tick from unproven output');
  });

  it('a DEGRADED certification is blocking in strict mode', () => {
    const lenient = evaluateGate({ deployments: [deployed], verifications: [{ target: 'vercel', verdict: verdict('VERIFIED') }], certification: { gate: 'DEGRADED', passed: 60, failed: 0, skipped: 6 } });
    assert.equal(lenient.status, 'DEGRADED');
    const strictRun = evaluateGate({ deployments: [deployed], verifications: [{ target: 'vercel', verdict: verdict('VERIFIED') }], certification: { gate: 'DEGRADED', passed: 60, failed: 0, skipped: 6 }, strict: true });
    assert.equal(strictRun.status, 'BLOCKED');
  });

  it('worst-of semantics: one blocked plane dominates the whole verdict', () => {
    const decision = evaluateGate({
      deployments: [
        deployed,
        { provider: 'huggingface', deploymentId: 'agi-system', url: 'https://elazamey-agi-system.hf.space', status: 'FAILED', platformState: 'Space reports an error/404', evidence: {} },
      ],
      verifications: [{ target: 'vercel', verdict: verdict('VERIFIED') }],
      certification: PASSED,
    });
    assert.equal(decision.status, 'BLOCKED');
    assert.match(decision.reasons.join('\n'), /huggingface: platform reports "Space reports an error\/404"/);
  });
});

describe('deployment plane adapters observe without asserting health', () => {
  let front: Fixture;
  let healthy: Fixture;

  before(async () => {
    front = await startFixture('frontend-only');
    healthy = await startFixture('conformant');
  });
  after(async () => {
    await Promise.all([front.close(), healthy.close()]);
  });

  it('carries the platform deployment id into the evidence', async () => {
    const target = vercelProductionTarget(healthy.url);
    assert.equal(target.mode, 'observe');
    const observed = await target.observe({ timeoutMs: 2_000 });
    assert.equal(observed.status, 'DEPLOYED');
    assert.equal(observed.deploymentId, 'iad1::fixture-deploy-0001');
    assert.equal(observed.evidence.x_vercel_id, 'iad1::fixture-deploy-0001');
    assert.match(String(observed.evidence.deploy_owner), /this repository does not trigger Vercel builds by design/);
  });

  it('reports a serving frontend with a dead backend as DEPLOYED — verification is what blocks it', async () => {
    const observed = await vercelProductionTarget(front.url).observe({ timeoutMs: 2_000 });
    assert.equal(observed.status, 'DEPLOYED', 'the deployment plane only answers "is it published"');
    const verdict = await verifyDeployment({ frontendUrl: front.url, backendBaseUrl: front.url });
    assert.equal(verdict.deployment, 'BLOCKED', '…and the verification plane answers "does it work"');
  });

  it('a HF Space in an error state fails on /health, and publish refuses without a token', async () => {
    const target = huggingFaceTarget(healthy.url, 'elazamey/agi-system');
    const ok = await target.observe({ timeoutMs: 2_000 });
    assert.equal(ok.status, 'DEPLOYED');
    assert.match(ok.platformState, /serving \/health \(version=1\.26\.0\)/);

    const broken = await huggingFaceTarget(front.url, 'elazamey/agi-system').observe({ timeoutMs: 2_000 });
    assert.equal(broken.status, 'FAILED');
    assert.match(broken.platformState, /not serving \(status=404\)/);

    const saved = process.env.HF_TOKEN;
    delete process.env.HF_TOKEN;
    const refused = await target.publish!({ commit: 'abc', ref: 'main', workdir: process.cwd() });
    assert.equal(refused.status, 'BLOCKED');
    assert.match(refused.message, /HF_TOKEN is not set; refusing to publish/);
    if (saved !== undefined) process.env.HF_TOKEN = saved;

    const dry = await target.publish!({ commit: 'abc', ref: 'main', workdir: process.cwd(), dryRun: true, env: { HF_TOKEN: 'x' } });
    assert.equal(dry.status, 'BLOCKED');
    assert.match(dry.message, /dry-run: push not executed/);
  });

  it('an unbound platform says BLOCKED instead of being silently absent', async () => {
    const target = unboundTarget('cloudflare', '', 'no CLOUDFLARE_ACCOUNT_ID in repo secrets');
    const observed = await target.observe();
    assert.equal(observed.status, 'UNKNOWN');
    assert.match(observed.platformState, /not bound/);
    const publish = await target.publish!({ commit: 'abc', ref: 'main', workdir: process.cwd() });
    assert.equal(publish.status, 'BLOCKED');
    assert.match(publish.message, /cloudflare is not configured/);
  });
});
