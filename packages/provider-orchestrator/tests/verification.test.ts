import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { probe, verifyDeployment, verdictSummary } from '../src/verification.ts';
import { startFixture, type Fixture } from './helpers/fixture-server.ts';

describe('probe()', () => {
  it('turns an unreachable origin into data instead of an exception', async () => {
    const result = await probe('http://127.0.0.1:1/health', { timeoutMs: 500 });
    assert.equal(result.status, 0);
    assert.match(result.error ?? '', /ECONNREFUSED|error/i);
    assert.equal(result.text, '');
    const invalid = await probe('not a url');
    assert.equal(invalid.status, 0);
    assert.match(invalid.error ?? '', /invalid url/);
  });

  it('parses json only when the content type says so', async () => {
    const fixture: Fixture = await startFixture('conformant');
    try {
      const json = await probe(`${fixture.url}/health`);
      assert.equal(json.status, 200);
      assert.deepEqual(json.json, { status: 'ok', uptime_s: 42, version: '1.26.0', active_missions: 0 });
      const html = await probe(`${fixture.url}/`);
      assert.equal(html.json, null, 'an HTML body is not coerced into json');
      assert.match(html.contentType, /text\/html/);
      assert.equal(html.headers['x-vercel-id'], 'iad1::fixture-deploy-0001', 'platform headers survive the probe');
    } finally {
      await fixture.close();
    }
  });
});

describe('verifyDeployment(): the post-deploy functional chain', () => {
  let good: Fixture;
  let noBackend: Fixture;
  let stub: Fixture;
  let broken: Fixture;

  before(async () => {
    good = await startFixture('conformant');
    noBackend = await startFixture('frontend-only');
    stub = await startFixture('stub');
    broken = await startFixture('error-page');
  });
  after(async () => {
    await Promise.all([good.close(), noBackend.close(), stub.close(), broken.close()]);
  });

  it('reports VERIFIED only when every link in the chain answers', async () => {
    const verdict = await verifyDeployment({ frontendUrl: good.url, backendBaseUrl: good.url, markers: ['AGI-OS'] });
    assert.deepEqual(verdictSummary(verdict), {
      frontend: 'PASS',
      frontend_http: 200,
      backend: 'PASS',
      backend_health: 200,
      api_contract: 'PASS',
      deployment: 'VERIFIED',
    });
    assert.deepEqual(
      good.requests.map((r) => r.url),
      ['/', '/health', '/ready', '/v1/models', '/v1/chat/completions'],
      'the chain has a fixed order: cheap checks first, contract last',
    );
    assert.equal(verdict.checks.every((c) => c.ok), true);
    assert.equal(verdict.checks.filter((c) => c.skipped).length, 0);
    assert.deepEqual(verdict.reasons, []);
    assert.ok(verdict.durationMs >= 0);
  });

  it('sends a real chat request and validates the OpenAI envelope', async () => {
    const before = good.requests.length;
    const verdict = await verifyDeployment({ frontendUrl: good.url, backendBaseUrl: good.url });
    const contract = verdict.checks.find((c) => c.label === 'chat contract');
    assert.equal(contract?.ok, true);
    assert.match(contract?.detail ?? '', /id=chatcmpl_fixture content=\d+ chars/);
    const sent = good.requests.slice(before).filter((r) => r.url === '/v1/chat/completions');
    assert.equal(sent.length, 1, 'exactly one chat request per verification run — no retry storms against a paid API');
    assert.equal(sent[0].method, 'POST');
  });

  it('a serving frontend over a dead backend is BLOCKED, never VERIFIED', async () => {
    const verdict = await verifyDeployment({ frontendUrl: noBackend.url, backendBaseUrl: noBackend.url });
    assert.equal(verdict.frontend, 'PASS', 'the UI is genuinely up — that is not in dispute');
    assert.equal(verdict.frontend_http, 200);
    assert.equal(verdict.backend, 'FAIL');
    assert.equal(verdict.backend_health, 404);
    assert.equal(verdict.api_contract, 'FAIL');
    assert.equal(verdict.deployment, 'BLOCKED');
    assert.match(verdict.reasons.join('\n'), /backend health/);
    assert.match(verdict.reasons.join('\n'), /models list/);
    assert.match(verdict.reasons.join('\n'), /chat contract/);
  });

  it('a backend that fakes its answer fails the contract check', async () => {
    const verdict = await verifyDeployment({ frontendUrl: stub.url, backendBaseUrl: stub.url });
    assert.equal(verdict.backend, 'PASS', '/health says ok — which is exactly why /health alone is not verification');
    assert.equal(verdict.api_contract, 'FAIL');
    assert.equal(verdict.deployment, 'BLOCKED');
    const contract = verdict.checks.find((c) => c.label === 'chat contract');
    assert.match(contract?.detail ?? '', /chatcmpl-stub/);
  });

  it('serving the wrong build is caught by the marker even at HTTP 200', async () => {
    const verdict = await verifyDeployment({ frontendUrl: good.url, backendBaseUrl: good.url, markers: ['build-id:deadbeef'] });
    assert.equal(verdict.frontend_http, 200);
    assert.equal(verdict.deployment, 'BLOCKED');
    const marker = verdict.checks.find((c) => c.label === 'app marker');
    assert.equal(marker?.ok, false);
    assert.match(marker?.detail ?? '', /is this the build we think it is/);
  });

  it('an unreachable backend blocks without skipping the rest of the report', async () => {
    const verdict = await verifyDeployment({ backendBaseUrl: broken.url });
    assert.equal(verdict.frontend, 'SKIP');
    assert.equal(verdict.deployment, 'BLOCKED');
    assert.equal(verdict.backend_health, 502);
    const labels = verdict.checks.map((c) => c.label);
    assert.ok(labels.includes('chat contract') && labels.includes('models list'), 'every step is still reported');
  });

  it('unproven steps degrade the verdict instead of passing it', async () => {
    const noBackendConfigured = await verifyDeployment({ frontendUrl: good.url });
    assert.equal(noBackendConfigured.frontend, 'PASS');
    assert.equal(noBackendConfigured.deployment, 'DEGRADED', 'frontend-only verification cannot certify a mission runtime');
    assert.match(noBackendConfigured.reasons.join('\n'), /unproven, not healthy/);

    const nothingConfigured = await verifyDeployment({});
    assert.equal(nothingConfigured.deployment, 'DEGRADED');
    assert.ok(nothingConfigured.checks.every((c) => c.skipped));
  });

  it('a missing /ready is reported as a skip, not an outage', async () => {
    const verdict = await verifyDeployment({ frontendUrl: good.url, backendBaseUrl: good.url });
    const ready = verdict.checks.find((c) => c.label === 'backend readiness');
    assert.equal(ready?.ok, true);
    assert.equal(ready?.skipped, false, 'the fixture implements /ready, so this step is a real pass, not a skip');
  });
});
