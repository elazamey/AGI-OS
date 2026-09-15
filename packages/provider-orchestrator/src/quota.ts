// ============================================================================
// Quota: the only place that decides "we cannot afford this call right now".
// ----------------------------------------------------------------------------
// Quota_exceeded is a routing input, not an error: it is what makes the ladder
// Arena → OpenRouter → HF → Local work without a human in the loop. The ledger
// therefore answers three questions per provider — requests/min, tokens left,
// USD left — and derives a HealthState from them.
// ============================================================================

import type { HealthState, ProviderRecord, QuotaState } from './types.ts';

export interface UsageEstimate {
  promptTokens: number;
  completionTokens: number;
}

const MINUTE = 60_000;

export function estimateTokens(requirement: { minTokens?: number }, prompt?: string): UsageEstimate {
  const promptTokens = requirement.minTokens ?? (prompt ? Math.ceil(prompt.length / 4) : 512);
  return { promptTokens, completionTokens: Math.max(64, Math.round(promptTokens / 2)) };
}

export function costUsd(record: ProviderRecord, usage: UsageEstimate): number {
  const rate = record.costPer1kTokensUsd ?? 0;
  return ((usage.promptTokens + usage.completionTokens) / 1000) * rate;
}

export interface QuotaVerdict {
  allowed: boolean;
  state: Extract<HealthState, 'available' | 'quota_exceeded' | 'rate_limited'>;
  reason?: string;
}

/** Pure check: does not consume anything. */
export function checkQuota(record: ProviderRecord, usage: UsageEstimate, now = Date.now()): QuotaVerdict {
  const quota: QuotaState = record.quota ?? {};
  const rpm = quota.requestsPerMinute;
  const inWindow = typeof quota.windowStartedAt === 'number' && now - quota.windowStartedAt < MINUTE;
  if (rpm !== undefined && inWindow && (quota.requestsThisMinute ?? 0) >= rpm) {
    return { allowed: false, state: 'rate_limited', reason: `${rpm} req/min window exhausted` };
  }
  const needed = usage.promptTokens + usage.completionTokens;
  if (quota.tokensRemaining !== undefined && quota.tokensRemaining < needed) {
    return {
      allowed: false,
      state: 'quota_exceeded',
      reason: `tokens: need ${needed}, have ${quota.tokensRemaining}`,
    };
  }
  const price = costUsd(record, usage);
  if (quota.usdRemaining !== undefined && price > quota.usdRemaining) {
    return { allowed: false, state: 'quota_exceeded', reason: `usd: need ${price.toFixed(4)}, have ${quota.usdRemaining.toFixed(4)}` };
  }
  return { allowed: true, state: 'available' };
}

/** Returns a new record with the usage charged against the window. */
export function consumeQuota(record: ProviderRecord, usage: UsageEstimate, now = Date.now()): ProviderRecord {
  const quota: QuotaState = record.quota ?? {};
  const inWindow = typeof quota.windowStartedAt === 'number' && now - quota.windowStartedAt < MINUTE;
  const next: QuotaState = {
    ...quota,
    windowStartedAt: inWindow ? quota.windowStartedAt : now,
    requestsThisMinute: inWindow ? (quota.requestsThisMinute ?? 0) + 1 : 1,
  };
  if (quota.tokensRemaining !== undefined) next.tokensRemaining = Math.max(0, quota.tokensRemaining - (usage.promptTokens + usage.completionTokens));
  if (quota.usdRemaining !== undefined) next.usdRemaining = Math.max(0, Number((quota.usdRemaining - costUsd(record, usage)).toFixed(6)));
  const verdict = checkQuota({ ...record, quota: next }, { promptTokens: 1, completionTokens: 1 }, now);
  return { ...record, quota: next, health: verdict.allowed ? record.health : verdict.state };
}
