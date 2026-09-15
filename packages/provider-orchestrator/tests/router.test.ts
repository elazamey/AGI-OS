import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatDecision, routeProviders } from '../src/router.ts';
import type { CapabilityRequirement, ProviderRecord } from '../src/types.ts';

const AT = 1_700_000_000_000;

const FREE = { basis: 'requests-per-day', limit: 10_000, hardStop: true } as const;

function provider(id: string, over: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id,
    kind: 'model',
    billing: 'free-tier',
    freeTier: { ...FREE },
    label: id,
    capabilities: ['chat', 'code.edit'],
    health: 'available',
    priority: 50,
    enabled: true,
    policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' },
    quota: {},
    probe: null,
    cooldownUntil: null,
    consecutiveFailures: 0,
    ...over,
  };
}

const chat: CapabilityRequirement = { capabilities: ['chat'] };
const reasonFor = (decision: ReturnType<typeof routeProviders>, id: string) => decision.rejected.find((r) => r.provider === id)?.reason ?? '';

describe('router: capability → health → free → quota → policy → ranking', () => {
  it('seeds the score with the declared priority and keeps the ladder ordered', () => {
    const decision = routeProviders({
      providers: [provider('local', { priority: 80 }), provider('arena', { priority: 10 }), provider('openrouter', { priority: 30 })],
      requirement: chat,
      now: AT,
    });
    assert.equal(decision.selected?.id, 'arena');
    assert.deepEqual(decision.ladder.map((p) => p.id), ['arena', 'openrouter', 'local']);
  });

  it('runs all six stages in order and records why each provider was excluded', () => {
    const decision = routeProviders({
      providers: [
        provider('nocap', { capabilities: ['text:embed'] }),
        provider('cooling', { cooldownUntil: AT + 5_000, health: 'rate_limited', probe: { at: AT - 5_000, state: 'rate_limited', reason: '429 from upstream' } }),
        provider('off', { enabled: false }),
        provider('arena', { priority: 10 }),
      ],
      requirement: chat,
      now: AT,
    });
    assert.equal(decision.selected?.id, 'arena');
    assert.deepEqual(
      decision.rejected.map((r) => [r.provider, r.stage]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        ['cooling', 'health'],
        ['nocap', 'capability'],
        ['off', 'health'],
      ],
    );
    assert.deepEqual(
      decision.trace.map((t) => t.stage),
      ['capability', 'health', 'free', 'quota', 'policy', 'ranking'],
      'the pipeline is the product: six stages, one entry each',
    );
    assert.match(decision.trace[2].note ?? '', /FREE_ONLY enforced/);
    assert.match(reasonFor(decision, 'cooling'), /cooldown for another 5s/);
    assert.match(reasonFor(decision, 'cooling'), /429 from upstream/, 'the reason must carry the observation, not just the label');
    assert.match(reasonFor(decision, 'nocap'), /missing: chat/, 'the rejection names the capability the task needs, not the ones the provider has');
    // Remaining pool must shrink monotonically down the pipeline.
    const sizes = decision.trace.map((t) => t.remaining.length);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));
    assert.deepEqual(decision.trace.map((t) => t.stage), ['capability', 'health', 'free', 'quota', 'policy', 'ranking']);
  });

  it('quota exhaustion is a routing input, not an exception', () => {
    const decision = routeProviders({
      providers: [
        provider('arena', { priority: 10, quota: { requestsPerMinute: 1, requestsThisMinute: 1, windowStartedAt: AT - 1_000 } }),
        provider('local', { priority: 80 }),
      ],
      requirement: chat,
      now: AT,
    });
    assert.equal(decision.selected?.id, 'local');
    assert.match(reasonFor(decision, 'arena'), /rate_limited: 1 req\/min window exhausted/);
  });

  it('a provider that cannot afford the call is excluded before it can fail mid-mission', () => {
    const decision = routeProviders({
      providers: [
        provider('arena', { priority: 10, quota: { tokensRemaining: 50 } }),
        provider('local', { priority: 80, quota: { tokensRemaining: 100_000 } }),
      ],
      requirement: { ...chat, minTokens: 4_000 },
      now: AT,
    });
    assert.equal(decision.selected?.id, 'local');
    assert.match(reasonFor(decision, 'arena'), /tokens: need 6000, have 50/);
  });

  it('a zero USD balance makes a paid provider unaffordable', () => {
    const decision = routeProviders({
      providers: [
        provider('hf', { priority: 20, costPer1kTokensUsd: 0.002, quota: { usdRemaining: 0 } }),
        provider('local', { priority: 80, costPer1kTokensUsd: 0 }),
      ],
      requirement: { ...chat, minTokens: 6_000 },
      now: AT,
    });
    assert.equal(decision.selected?.id, 'local');
    assert.match(reasonFor(decision, 'hf'), /quota_exceeded: usd: need/);
  });

  it('a cost ceiling in the requirement caps what may be spent', () => {
    const decision = routeProviders({
      providers: [provider('expensive', { priority: 10, costPer1kTokensUsd: 0.5 }), provider('cheap', { priority: 90, costPer1kTokensUsd: 0 })],
      requirement: { ...chat, maxCostPer1kUsd: 0.01 },
      now: AT,
    });
    assert.equal(decision.selected?.id, 'cheap');
    assert.match(reasonFor(decision, 'expensive'), /maxCostPer1kUsd/);
  });

  it('policy: production deploys are held for approval until a human grants it', () => {
    const providers = [
      provider('arena', {
        priority: 10,
        capabilities: ['chat', 'deploy:production'],
        policy: { allowAutoExecute: true, requiresApprovalFor: ['deploy:production'], dataBoundary: 'any' },
      }),
      provider('local', {
        priority: 80,
        capabilities: ['chat', 'deploy:production'],
        policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'local-only' },
      }),
    ];
    const held = routeProviders({ providers, requirement: { capabilities: ['chat', 'deploy:production'] }, now: AT });
    assert.deepEqual(held.awaitingApproval, [{ provider: 'arena', capabilities: ['deploy:production'] }]);
    assert.equal(held.selected?.id, 'local', 'a provider awaiting approval must not be selected');
    assert.match(reasonFor(held, 'arena'), /approval required for: deploy:production/);

    const granted = routeProviders({
      providers,
      requirement: { capabilities: ['chat', 'deploy:production'] },
      grantedApprovals: ['deploy:production'],
      now: AT,
    });
    assert.deepEqual(granted.awaitingApproval, []);
    assert.equal(granted.selected?.id, 'arena', 'an explicit grant unblocks the preferred provider');

    const empty = routeProviders({ providers: [], requirement: chat, now: AT });
    assert.equal(empty.selected, null, 'an empty pool is reported as such');

    const localOnly = routeProviders({
      providers: [
        provider('cloud', { priority: 10 }),
        provider('local', { priority: 80, policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'local-only' } }),
      ],
      requirement: { capabilities: ['chat'], mustBeLocal: true },
      now: AT,
    });
    assert.equal(localOnly.selected?.id, 'local');
    assert.match(reasonFor(localOnly, 'cloud'), /dataBoundary=any, task requires local-only/);
  });

  it('tool execution needs a provider that is allowed to auto-execute', () => {
    const decision = routeProviders({
      providers: [
        provider('guarded', { priority: 10, capabilities: ['chat', 'tools.shell'], policy: { allowAutoExecute: false, requiresApprovalFor: [], dataBoundary: 'any' } }),
        provider('local', { priority: 80, capabilities: ['chat', 'tools.shell'] }),
      ],
      requirement: { capabilities: ['chat', 'tools.shell'] },
      now: AT,
    });
    assert.equal(decision.selected?.id, 'local');
    assert.match(reasonFor(decision, 'guarded'), /allowAutoExecute=false/);
  });

  it('an exhausted pool returns NONE with an actionable trace instead of throwing', () => {
    const decision = routeProviders({ providers: [provider('arena', { health: 'unhealthy', probe: { at: AT, state: 'unhealthy', reason: 'connection refused' } })], requirement: chat, now: AT });
    assert.equal(decision.selected, null);
    assert.equal(decision.ladder.length, 0);
    const rendered = formatDecision(decision);
    assert.match(rendered, /selected: NONE/);
    assert.match(rendered, /arena @ health: state=unhealthy \(connection refused\)/);
  });

  it('ranking is a total order: score first, then id — never the config number alone', () => {
    const fast = provider('aaa-fast', { priority: 10, lastLatencyMs: 100 });
    const slow = provider('bbb-slow', { priority: 10, lastLatencyMs: 4000 });
    const ordered = routeProviders({ providers: [slow, fast], requirement: chat, now: AT });
    assert.equal(ordered.selected?.id, 'aaa-fast');
    const scores = Object.fromEntries(ordered.scores.map((s) => [s.id, s.score]));
    assert.ok(scores['aaa-fast'] > scores['bbb-slow'], `fast must outscore slow: ${JSON.stringify(scores)}`);
    assert.equal(ordered.trace[5].note, `aaa-fast: ${scores['aaa-fast']} · bbb-slow: ${scores['bbb-slow']}`, 'the ranking stage prints the scores it used, best first');
    assert.deepEqual(Object.keys(ordered.scores.find((s) => s.id === 'aaa-fast')!.parts), ['capability', 'availability', 'quota', 'latency', 'reliability', 'taskFit', 'penalty', 'bias']);

    // "cheapest" in a free-first system means the most *remaining allowance*, not the
    // lowest sticker price: the metered case is already blocked by FREE_ONLY.
    const nearlyEmpty = provider('zzz-nearly-empty', { priority: 10, lastLatencyMs: 100, freeTier: { basis: 'requests-per-day', limit: 100, remaining: 3, hardStop: true } });
    const wideOpen = provider('aaa-wide-open', { priority: 10, lastLatencyMs: 9_000, freeTier: { basis: 'requests-per-day', limit: 100, remaining: 95, hardStop: true } });
    assert.equal(routeProviders({ providers: [nearlyEmpty, wideOpen], requirement: { ...chat, prefer: 'cheapest' }, now: AT }).selected?.id, 'aaa-wide-open');
    assert.equal(routeProviders({ providers: [nearlyEmpty, wideOpen], requirement: { ...chat, prefer: 'fastest' }, now: AT }).selected?.id, 'zzz-nearly-empty');
  });

  it('the two routers never see each other’s providers', () => {
    const mixed = [
      provider('openrouter-free', { priority: 10 }),
      { ...provider('arena', { priority: 1, billing: 'subscription' as const, freeTier: undefined }), kind: 'agent' as const },
      { ...provider('vercel', { priority: 1 }), kind: 'deployment' as const },
      { ...provider('certification', { priority: 1 }), kind: 'verification' as const },
    ];
    const models = routeProviders({ providers: mixed, requirement: chat, plane: 'model', now: AT });
    assert.deepEqual(models.ladder.map((p) => p.id), ['openrouter-free'], 'the Model Router routes model providers only');
    const agents = routeProviders({ providers: mixed, requirement: chat, plane: 'agent', now: AT });
    assert.deepEqual(agents.ladder.map((p) => p.id), ['arena'], 'and the Agent Router routes adapters only — a prompt API cannot run a mission');
    assert.ok(!models.rejected.some((x) => x.provider === 'arena'), 'the other plane is not even rejected: it is not in the pool');
    const arenaFree = agents.freeFirst[0] as Record<string, unknown>;
    assert.equal(arenaFree.verdict, 'SUBSCRIPTION_OK', 'a subscription is already paid for, which is not the same as free');
  });
});
