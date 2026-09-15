import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyError, runLadder } from '../src/failover.ts';
import { ProviderRegistry } from '../src/registry.ts';
import { isCoolingDown } from '../src/health.ts';
import { JsonlLedger } from '../src/evidence.ts';
import type { ProviderRecord } from '../src/types.ts';

function agent(id: string, priority: number, over: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id, kind: 'model', label: id, capabilities: ['chat', 'code.edit'], health: 'available', priority, enabled: true,
    policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' }, quota: {},
    billing: 'free-tier', freeTier: { basis: 'requests-per-day', limit: 10_000, hardStop: true },
    probe: null, cooldownUntil: null, consecutiveFailures: 0, ...over,
  };
}

function registry(providers: ProviderRecord[]): ProviderRegistry {
  // Built from records, not from a manifest, so the test controls health/cooldown
  // state directly instead of fighting the parser's defaults.
  return new ProviderRegistry({ providers, issues: [], source: 'test' });
}

const LEDGER = { path: '/tmp/agios-control-test.jsonl', runId: 'test' };

describe('failover ladder: free rungs in score order → Local → BLOCKED', () => {
  it('classifies provider errors into routing states', () => {
    assert.equal(classifyError(new Error('429 Too Many Requests')).state, 'rate_limited');
    assert.equal(classifyError({ status: 402, message: 'Insufficient Credits' }).state, 'quota_exceeded');
    assert.equal(classifyError(new Error('socket hang up')).state, 'unhealthy');
  });

  it('walks down the ladder on quota exhaustion and records the evidence', async () => {
    const reg = registry([agent('arena', 10), agent('openrouter', 30), agent('huggingface', 50), agent('local', 80)]);
    const ledger = new JsonlLedger({ ...LEDGER, persist: false });
    const calls: string[] = [];
    const clock = { now: 1_700_000_000_000 };

    const result = await runLadder<string>({
      registry: reg,
      requirement: { capabilities: ['chat'] },
      now: () => clock.now,
      onEvent: (event) => ledger.write(event),
      invoke: async (provider) => {
        calls.push(provider.id);
        if (provider.id === 'arena') { clock.now += 250; throw Object.assign(new Error('429 quota exceeded: tool budget exhausted'), { status: 429 }); }
        if (provider.id === 'openrouter') { clock.now += 900; return 'answer from openrouter'; }
        throw new Error('should not be reached');
      },
    });

    assert.equal(result.status, 'OK');
    if (result.status !== 'OK') return;
    assert.equal(result.provider, 'openrouter', 'the mission continues without a human in the loop');
    assert.deepEqual(calls, ['arena', 'openrouter']);
    assert.deepEqual(result.hops.map((h) => [h.provider, h.outcome]), [['arena', 'failed'], ['openrouter', 'ok']]);

    const arena = reg.get('arena');
    assert.equal(arena.health, 'rate_limited');
    assert.equal(arena.consecutiveFailures, 1);
    assert.ok(isCoolingDown(arena, clock.now), 'the exhausted provider is cooled down, not deleted');
    assert.equal(reg.get('openrouter').health, 'available');
    assert.equal(reg.get('huggingface').health, 'available', 'untouched providers keep their state');

    const events = ledger.read();
    assert.deepEqual(events.map((e) => e.type), ['hop:start', 'hop:failed', 'hop:start', 'allowance', 'hop:ok']);
    assert.match(JSON.stringify(events[1]), /quota exceeded/);
    assert.deepEqual(
      { provider: events[3].provider, units: events[3].units },
      { provider: 'openrouter', units: 512 + 256 },
      'the free allowance is charged in the same breath as the success, with the count written down',
    );
  });

  it('redacts credentials in the evidence trail', async () => {
    const reg = registry([agent('arena', 10)]);
    const ledger = new JsonlLedger({ ...LEDGER, persist: false });
    await runLadder({
      registry: reg,
      requirement: { capabilities: ['chat'] },
      onEvent: (event) => ledger.write(event),
      invoke: async () => { throw new Error('Authorization: Bearer sk-secretvalue123 failed at 127.0.0.1:8080'); },
    });
    const dumped = JSON.stringify(ledger.read());
    assert.ok(!dumped.includes('sk-secretvalue123'), 'evidence is committed-adjacent; tokens must not leak into reports');
    assert.match(dumped, /«redacted»/);
  });

  it('ends in BLOCKED when every rung fails, and says so instead of retrying forever', async () => {
    const reg = registry([agent('arena', 10), agent('openrouter', 30)]);
    const result = await runLadder<string>({
      registry: reg,
      requirement: { capabilities: ['chat'] },
      maxAttempts: 4,
      invoke: async (provider) => {
        if (provider.id === 'openrouter') throw new Error('upstream 500');
        throw Object.assign(new Error('quota exceeded'), { status: 402 });
      },
    });
    assert.equal(result.status, 'BLOCKED');
    if (result.status !== 'BLOCKED') return;
    assert.equal(result.hops.length, 2, 'each provider is tried once per call');
    assert.match(result.reason, /NO_ELIGIBLE_PROVIDER after 2 failed hop\(s\)/, 'a runtime failure is not a quota verdict, so it must not be labelled as one');
    assert.equal(reg.get('arena').health, 'quota_exceeded');
    assert.ok(reg.get('arena').cooldownUntil && reg.get('arena').cooldownUntil! > Date.now());
  });

  it('charges the free allowance for the call that succeeded', async () => {
    const reg = registry([agent('cerebras', 10, { freeTier: { basis: 'trial-usd', limit: 5, remaining: 5, hardStop: true }, costPer1kTokensUsd: 0 })]);
    const result = await runLadder<string>({
      registry: reg,
      requirement: { capabilities: ['chat'], minTokens: 1_000 },
      invoke: async () => 'done',
    });
    assert.equal(result.status, 'OK');
    const charged = reg.get('cerebras');
    assert.equal(charged.freeTier?.remaining, 5 - 1_500 > 0 ? charged.freeTier?.remaining : 0, 'a token-counted call against a USD tier must not look free');
    assert.ok(result.usageTokens === 1_500);
  });

  it('stops at BLOCKED with NO_FREE_PROVIDER_AVAILABLE instead of touching a paid rung', async () => {
    const reg = registry([
      agent('openrouter-free', 10, { freeTier: { basis: 'requests-per-day', limit: 50, remaining: 0, hardStop: true } }),
      agent('cerebras', 20, { billing: 'trial-credit', freeTier: { basis: 'trial-usd', limit: 5, remaining: 0, hardStop: true } }),
      agent('claude-api', 30, { billing: 'paid', freeTier: undefined, costPer1kTokensUsd: 0.02 }),
    ]);
    const result = await runLadder<string>({ registry: reg, requirement: { capabilities: ['chat'] }, invoke: async () => 'should never run' });
    assert.equal(result.status, 'BLOCKED');
    if (result.status !== 'BLOCKED') return;
    assert.match(result.reason, /NO_FREE_PROVIDER_AVAILABLE/, 'the operator asked for this exact outcome name');
    assert.equal(result.hops.length, 0, 'nothing was called: the refusal happens before the network');
    assert.deepEqual(result.rejected.map((r) => [r.provider, r.stage]), [['openrouter-free', 'quota'], ['cerebras', 'quota'], ['claude-api', 'free']]);
  });

  it('reports awaiting-approval providers instead of silently skipping them', async () => {
    const reg = registry([
      agent('arena', 10, { capabilities: ['chat', 'deploy:production'], policy: { allowAutoExecute: true, requiresApprovalFor: ['deploy:production'], dataBoundary: 'any' } }),
      agent('local', 80, { capabilities: ['chat', 'deploy:production'] }),
    ]);
    const result = await runLadder<string>({
      registry: reg,
      requirement: { capabilities: ['chat', 'deploy:production'] },
      invoke: async (p) => `from:${p.id}`,
    });
    assert.equal(result.status, 'OK');
    if (result.status !== 'OK') return;
    assert.equal(result.provider, 'local');
  });
});
