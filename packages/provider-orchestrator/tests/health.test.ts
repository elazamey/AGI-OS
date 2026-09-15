import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyProbe, cooldownFor, healthPenalty, isCoolingDown, isUsable, stateFromStatus } from '../src/health.ts';
import type { ProviderRecord } from '../src/types.ts';

const base: ProviderRecord = {
  id: 'p',
  kind: 'agent',
  label: 'p',
  capabilities: ['chat'],
  health: 'available',
  priority: 1,
  enabled: true,
  policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' },
  quota: {},
  probe: null,
  cooldownUntil: null,
  consecutiveFailures: 0,
};

describe('health plane: observation → state → cooldown', () => {
  it('maps a transport observation onto a state, using the same thresholds as the certification runner', () => {
    assert.equal(stateFromStatus(0), 'unhealthy', 'no response at all is the worst signal');
    assert.equal(stateFromStatus(503), 'unhealthy');
    assert.equal(stateFromStatus(429), 'rate_limited');
    assert.equal(stateFromStatus(402), 'quota_exceeded');
    assert.equal(stateFromStatus(404), 'degraded', 'a wrong path is a routing problem, not an outage');
    assert.equal(stateFromStatus(200), 'available');
    assert.equal(stateFromStatus(200, { error: 'daily quota exceeded' }), 'quota_exceeded', 'a 200 body that says quota is quota');
  });

  it('backs off exponentially and stops at the ceiling', () => {
    assert.equal(cooldownFor('available', 3), 0, 'a healthy provider gets no cooldown');
    assert.equal(cooldownFor('degraded', 3), 0, 'degraded stays routable');
    assert.equal(cooldownFor('rate_limited', 1), 15_000);
    assert.equal(cooldownFor('rate_limited', 2), 30_000);
    assert.equal(cooldownFor('rate_limited', 4), 120_000);
    assert.equal(cooldownFor('unhealthy', 12, { maxMs: 1_000 }), 1_000, 'capped, or a long outage would freeze the ladder for hours');
  });

  it('a failure sets a cooldown; the provider returns by itself without a human', () => {
    const failed = applyProbe(base, { at: 1_000, state: 'rate_limited', reason: '429 from upstream' });
    assert.equal(failed.consecutiveFailures, 1);
    assert.equal(failed.cooldownUntil, 16_000);
    assert.equal(isCoolingDown(failed, 15_000), true);
    assert.equal(isUsable(failed, 15_000), false);
    assert.equal(isUsable(failed, 16_001), true, 'the window lapsing is the recovery mechanism');
    assert.equal(failed.health, 'rate_limited');

    const second = applyProbe(failed, { at: 20_000, state: 'quota_exceeded', reason: 'no credits' });
    assert.equal(second.cooldownUntil, 50_000, 'the second consecutive failure doubles the backoff');
    assert.equal(second.consecutiveFailures, 2);

    const recovered = applyProbe(second, { at: 60_000, state: 'available', reason: 'probe ok', latencyMs: 210 });
    assert.equal(recovered.consecutiveFailures, 0);
    assert.equal(recovered.cooldownUntil, null);
    assert.equal(recovered.lastLatencyMs, 210, 'the successful latency is carried forward for ranking');
  });

  it('probes never mutate the record they were given', () => {
    const before = JSON.stringify(base);
    applyProbe(base, { at: 1, state: 'unhealthy', reason: 'boom' });
    assert.equal(JSON.stringify(base), before, 'the registry is shared state; a router must not race with itself');
  });

  it('unhealthy excludes; degraded, unknown and cooled-down states do not', () => {
    assert.equal(isUsable({ ...base, health: 'unhealthy' }, 0), false);
    assert.equal(isUsable({ ...base, health: 'degraded' }, 0), true);
    assert.equal(isUsable({ ...base, health: 'unknown' }, 0), true, 'never probed is not the same as broken');
    assert.equal(isUsable({ ...base, health: 'cooldown', cooldownUntil: 5 }, 4), false);
    assert.equal(isUsable({ ...base, health: 'cooldown', cooldownUntil: 5 }, 6), true);

    assert.ok(healthPenalty({ ...base, health: 'degraded' }) > healthPenalty({ ...base, health: 'available' }));
    assert.equal(healthPenalty({ ...base, health: 'available' }), 0);
    assert.ok(healthPenalty({ ...base, health: 'quota_exceeded' }) > 50, 'anything short of unavailable is still penalised in ranking');
  });
});
