import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allowanceRemaining, consumeAllowance, evaluateFreeFirst, paidOverrideGranted } from '../src/free-first.ts';
import { registryFromManifest } from '../src/registry.ts';
import type { CapabilityRequirement, ProviderRecord } from '../src/types.ts';

const AT = 1_700_000_000_000;
const chat: CapabilityRequirement = { capabilities: ['chat'] };

function provider(over: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'p', kind: 'model', label: 'p', capabilities: ['chat'], health: 'available', priority: 10, enabled: true,
    policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' }, quota: {},
    billing: 'free-tier', freeTier: { basis: 'requests-per-day', limit: 100, hardStop: true },
    probe: null, cooldownUntil: null, consecutiveFailures: 0, ...over,
  };
}

describe('FREE_ONLY: the entitlement gate', () => {
  it('refuses a paid API and names the override it would need', () => {
    const verdict = evaluateFreeFirst({ record: provider({ billing: 'paid' }), requirement: chat, now: AT });
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.stage, 'free');
    assert.equal(verdict.state, 'quota_exceeded', 'draining health is what keeps the ladder moving past it');
    assert.match(verdict.reason, /FREE_ONLY forbids an automatic upgrade/);
    assert.match(verdict.reason, /paid:override/);
    assert.equal(verdict.evidence.verdict, 'BLOCKED_PAID');
  });

  it('lets a paid API through only on an explicit, double-logged human decision', () => {
    const intentOnly = evaluateFreeFirst({ record: provider({ billing: 'paid' }), requirement: { ...chat, allowPaidOverride: true }, now: AT });
    assert.equal(intentOnly.allowed, false, 'an intent without the approval token is not a grant');
    const granted = evaluateFreeFirst({ record: provider({ billing: 'paid' }), requirement: { ...chat, allowPaidOverride: true, approvals: ['paid:override'] }, now: AT });
    assert.equal(granted.allowed, true, 'intent + token is a decision, and it is attributable to a human');
    const onRecord = evaluateFreeFirst({ record: provider({ billing: 'paid', paidOverride: true }), requirement: chat, now: AT });
    assert.equal(onRecord.allowed, true);
    assert.equal(paidOverrideGranted(provider({ billing: 'paid' }), chat), false);
    assert.equal(paidOverrideGranted(provider({ billing: 'paid', paidOverride: true }), chat), true);
  });

  it('treats each platform\u2019s free tier as the thing it actually is', () => {
    // OpenRouter: a per-day request ceiling.
    const openrouter = evaluateFreeFirst({ record: provider({ id: 'openrouter-free', freeTier: { basis: 'requests-per-day', limit: 50, used: 10, hardStop: true } }), requirement: chat, now: AT });
    assert.equal(openrouter.allowed, true);
    assert.equal(openrouter.runway, 0.8);
    assert.match(openrouter.reason, /40 requests of 50 requests/);

    // Cerebras: a finite grant that converts to metered the moment it empties.
    const cerebras = evaluateFreeFirst({ record: provider({ id: 'cerebras', billing: 'trial-credit', freeTier: { basis: 'trial-usd', limit: 5, remaining: 0, hardStop: true } }), requirement: chat, now: AT });
    assert.equal(cerebras.allowed, false);
    assert.equal(cerebras.stage, 'quota');
    assert.match(cerebras.reason, /trial credit spent \(\$5 granted on this account\)/);

    // Hugging Face: a monthly credit; hardStop is the difference between $0.10 and a bill.
    const hf = evaluateFreeFirst({ record: provider({ id: 'hf', billing: 'trial-credit', freeTier: { basis: 'usd-per-month', limit: 0.1, remaining: 0, hardStop: true } }), requirement: chat, now: AT });
    assert.equal(hf.allowed, false);
    assert.match(hf.reason, /usd-per-month allowance exhausted \(\$0 of \$0\.1\) — hard stop/);

    // Cloudflare: neurons per day, and the model itself has to be on the free plan.
    const cf = evaluateFreeFirst({
      record: provider({ id: 'cloudflare-ai', freeTier: { basis: 'neurons-per-day', limit: 10_000, hardStop: true, freeModels: ['@cf/meta/llama-3.1-8b-instruct'] } }),
      requirement: { ...chat, model: '@cf/moonshotai/kimi-k2-instruct' },
      now: AT,
    });
    assert.equal(cf.allowed, false);
    assert.equal(cf.evidence.verdict, 'MODEL_NOT_FREE', 'the free tier is per model, so the model is checked before the provider is trusted');
    assert.match(cf.reason, /is not on cloudflare-ai's free plan \(free: @cf\/meta\/llama-3\.1-8b-instruct\)/);

    // Local: nothing to run out.
    const local = evaluateFreeFirst({ record: provider({ id: 'local', freeTier: { basis: 'unlimited-local', limit: 1, hardStop: true } }), requirement: chat, now: AT });
    assert.equal(local.allowed, true);
    assert.equal(local.runway, 1);
  });

  it('refuses a soft-stop allowance instead of honouring it', () => {
    // Someone could write hardStop:false to "just get this call through". That is the
    // auto-upgrade this policy exists to stop, so it is rejected even when configured.
    const verdict = evaluateFreeFirst({ record: provider({ freeTier: { basis: 'requests-per-day', limit: 10, remaining: 0, hardStop: false } }), requirement: chat, now: AT });
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.evidence.verdict, 'QUOTA_EMPTY_SOFT_CONFIG_REJECTED');
    assert.match(verdict.reason, /hardStop is off — refusing anyway under FREE_ONLY/);
  });

  it('keeps a subscription adapter out of the model plane', () => {
    const asModel = evaluateFreeFirst({ record: provider({ id: 'arena', billing: 'subscription', freeTier: undefined }), requirement: chat, plane: 'model', now: AT });
    assert.equal(asModel.allowed, false);
    assert.match(asModel.reason, /Agent Router owns this provider/);
    const asAgent = evaluateFreeFirst({ record: provider({ id: 'arena', billing: 'subscription', freeTier: undefined }), requirement: chat, plane: 'agent', now: AT });
    assert.equal(asAgent.allowed, true);
    assert.equal(asAgent.evidence.verdict, 'SUBSCRIPTION_OK');
    assert.match(String(asAgent.evidence.note), /already-billed/);
  });

  it('counts an allowance down, and rolls it over when the window resets', () => {
    const start = provider({ freeTier: { basis: 'requests-per-day', limit: 100, used: 0, remaining: 100, resetsAt: AT + 86_400_000, hardStop: true } });
    const after = consumeAllowance(start, 30, AT);
    assert.deepEqual([after.freeTier?.used, after.freeTier?.remaining], [30, 70]);
    const spent = consumeAllowance({ ...after, freeTier: { ...after.freeTier!, remaining: 5 } }, 30, AT);
    assert.equal(spent.freeTier?.remaining, 0, 'clamped at zero: a negative allowance would read as "extra credit"');
    assert.equal(start.freeTier?.remaining, 100, 'no mutation of the registry record');

    const expired = consumeAllowance({ ...after, freeTier: { ...after.freeTier!, remaining: 0, used: 100, resetsAt: AT - 1 } }, 1, AT);
    assert.equal(expired.freeTier?.used, 1, 'a new day starts the counter over, so a hard stop is not permanent');
    assert.deepEqual(allowanceRemaining({ basis: 'requests-per-day', limit: 100, used: 40, remaining: 0, resetsAt: AT - 1, hardStop: true }, AT), { remaining: 100, limit: 100, runway: 1, expiredWindow: true });
  });
});

describe('manifest parsing: the guard runs at load time', () => {
  const parse = (manifest: never) => registryFromManifest(manifest);

  it('rejects a free tier it cannot enforce', () => {
    const noAllowance = parse({ models: [{ id: 'x', capabilities: ['chat'], billing: 'free-tier' }] } as never);
    assert.match(noAllowance.issues[0].problem, /no freeTier|billing=free-tier with no freeTier/);

    const softStop = parse({ models: [{ id: 'hf', capabilities: ['chat'], freeTier: { basis: 'usd-per-month', limit: 0.1, hardStop: false } }] } as never);
    assert.match(softStop.issues[0].problem, /hardStop:false on a usd-per-month tier allows the router to cross into pay-as-you-go/);

    const zeroLimit = parse({ models: [{ id: 'ghost', capabilities: ['chat'], freeTier: { basis: 'requests-per-day', limit: 0, hardStop: true } }] } as never);
    assert.match(zeroLimit.issues[0].problem, /declares a provider with no allowance/);

    const badBilling = parse({ models: [{ id: 'y', capabilities: ['chat'], billing: 'freemium' }] } as never);
    assert.match(badBilling.issues[0].problem, /unknown billing "freemium"/);
    assert.equal(noAllowance.providers.length, 0, 'a rejected provider is dropped from routing, not half-trusted');
  });
});
