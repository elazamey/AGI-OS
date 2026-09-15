import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkQuota, consumeQuota, costUsd, estimateTokens } from '../src/quota.ts';
import type { ProviderRecord } from '../src/types.ts';

const AT = 1_700_000_000_000;

function provider(over: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'p', kind: 'agent', label: 'p', capabilities: ['chat'], health: 'available', priority: 1, enabled: true,
    policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' }, quota: {},
    probe: null, cooldownUntil: null, consecutiveFailures: 0, ...over,
  };
}

describe('quota plane', () => {
  it('estimates from the prompt, and an explicit floor wins', () => {
    assert.equal(estimateTokens({ minTokens: 5_000 }, 'short').promptTokens, 5_000, 'a caller that declared its window is believed');
    const fromPrompt = estimateTokens({ capabilities: ['chat'] }, 'x'.repeat(4_000));
    assert.equal(fromPrompt.promptTokens, 1_000, '≈4 chars/token');
    assert.equal(fromPrompt.completionTokens, 500, 'a completion is budgeted at half the prompt');
    const empty = estimateTokens({ capabilities: ['chat'] });
    assert.ok(empty.promptTokens >= 512, 'an omitted prompt still costs the system+history floor');
  });

  it('cost is per 1k tokens, and free providers cost nothing', () => {
    assert.equal(costUsd(provider({}), { promptTokens: 10_000, completionTokens: 10_000 }), 0);
    assert.equal(costUsd(provider({ costPer1kTokensUsd: 0.003 }), { promptTokens: 1_000, completionTokens: 1_000 }), 0.006);
  });

  it('rejects on rate, tokens and money — each with a different health state', () => {
    const rateLimited = checkQuota(provider({ quota: { requestsPerMinute: 10, requestsThisMinute: 10, windowStartedAt: AT - 30_000 } }), { promptTokens: 10, completionTokens: 10 }, AT);
    assert.equal(rateLimited.allowed, false);
    assert.equal(rateLimited.state, 'rate_limited', 'a rate window is expected to reopen, so it is not "out of credit"');
    assert.match(rateLimited.reason ?? '', /10 req\/min window exhausted/);

    const outOfTokens = checkQuota(provider({ quota: { tokensRemaining: 100 } }), { promptTokens: 500, completionTokens: 100 }, AT);
    assert.equal(outOfTokens.state, 'quota_exceeded');
    assert.match(outOfTokens.reason ?? '', /tokens: need 600, have 100/);

    const outOfMoney = checkQuota(provider({ costPer1kTokensUsd: 0.01, quota: { usdRemaining: 0.001 } }), { promptTokens: 1_000, completionTokens: 1_000 }, AT);
    assert.equal(outOfMoney.state, 'quota_exceeded');
    assert.match(outOfMoney.reason ?? '', /usd: need 0.0200, have 0.0010/);

    assert.equal(checkQuota(provider(), { promptTokens: 1_000_000, completionTokens: 1_000_000 }, AT).allowed, true, 'no declared quota means no limit, not zero');
  });

  it('a stale window rolls over instead of staying stuck', () => {
    const spent = provider({ quota: { requestsPerMinute: 1, requestsThisMinute: 1, windowStartedAt: AT - 61_000 } });
    assert.equal(checkQuota(spent, { promptTokens: 10, completionTokens: 10 }, AT).allowed, true);
    const consumed = consumeQuota(spent, { promptTokens: 10, completionTokens: 10 }, AT);
    assert.deepEqual([consumed.quota.requestsThisMinute, consumed.quota.windowStartedAt], [1, AT], 'the window restarts at the call, not at the old start');
  });

  it('consumption is monotonic, clamped, and never negative', () => {
    const start = provider({ quota: { requestsPerMinute: 60, tokensRemaining: 1_000, usdRemaining: 1 } });
    const after = consumeQuota(start, { promptTokens: 100, completionTokens: 100 }, AT);
    assert.equal(after.quota.requestsThisMinute, 1);
    assert.equal(after.quota.tokensRemaining, 800);
    const overdrawn = consumeQuota(after, { promptTokens: 5_000, completionTokens: 5_000 }, AT);
    assert.equal(overdrawn.quota.tokensRemaining, 0, 'a negative balance would silently disable the budget guard');
    assert.equal(overdrawn.health, 'quota_exceeded', 'running the balance to zero flips health so the router skips it next time');
    assert.equal(start.quota.tokensRemaining, 1_000, 'the input record is not mutated');
  });

  it('exhaustion is derived from the remaining balance, not from the API being nice', () => {
    const broke = provider({ quota: { requestsPerMinute: 10, requestsThisMinute: 10, windowStartedAt: AT - 1_000 } });
    const used = consumeQuota(broke, { promptTokens: 10, completionTokens: 10 }, AT);
    assert.equal(used.health, 'rate_limited');
    assert.ok(used.quota.requestsThisMinute === 11, 'the counter still advances so the window arithmetic stays honest');
  });
});
