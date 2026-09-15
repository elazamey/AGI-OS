// ============================================================================
// Health: observation → state, with a cooldown that cannot spin.
// ----------------------------------------------------------------------------
// Failover without a cooldown is just a busy loop against a failing provider
// (and in the pre-fix Space, 20 requests × 30s of timeouts). Every failed probe
// therefore doubles the exclusion window up to `maxCooldownMs`, and every probe
// result is *derived* from data rather than asserted by the caller.
// ============================================================================

import type { HealthState, ProbeResult, ProviderRecord } from './types.ts';

export interface CooldownOptions {
  baseMs?: number;
  maxMs?: number;
}

const DEFAULTS = { baseMs: 15_000, maxMs: 5 * 60_000 } as const;

/** Map transport/HTTP observations onto the state vocabulary. */
export function stateFromStatus(httpStatus: number, body?: unknown): HealthState {
  if (httpStatus === 0) return 'unhealthy';
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus === 402) return 'quota_exceeded';
  if (httpStatus >= 500) return 'unhealthy';
  if (httpStatus >= 400) return 'degraded';
  const quotaFlag =
    body && typeof body === 'object' &&
    /quota|exceeded|limit/i.test(String((body as Record<string, unknown>).error ?? (body as Record<string, unknown>).reason ?? ''));
  return quotaFlag ? 'quota_exceeded' : 'available';
}

/** Exponential backoff, capped: 15s, 30s, 60s, 120s, 240s, 300s… */
export function cooldownFor(state: HealthState, failures: number, options: CooldownOptions = {}): number {
  const base = options.baseMs ?? DEFAULTS.baseMs;
  const max = options.maxMs ?? DEFAULTS.maxMs;
  if (state === 'available' || state === 'degraded') return 0;
  return Math.min(max, base * 2 ** Math.min(Math.max(failures, 1) - 1, 5));
}

/**
 * Apply a probe to a record and return the next record (never mutating the
 * input: the registry is shared state, and a router must not race with itself).
 */
export function applyProbe(
  record: ProviderRecord,
  probe: ProbeResult,
  options: CooldownOptions = {},
): ProviderRecord {
  const failing = probe.state !== 'available' && probe.state !== 'degraded';
  const failures = failing ? (record.consecutiveFailures ?? 0) + 1 : 0;
  const cooldownUntil = failing ? probe.at + cooldownFor(probe.state, failures, options) : null;
  // A provider that answers but is merely degraded stays selectable: an
  // "unhealthy" label is what starves a system of every fallback at once.
  const health: HealthState = failing && cooldownUntil ? (probe.state === 'unhealthy' ? 'cooldown' : probe.state) : probe.state;
  return {
    ...record,
    health,
    probe,
    consecutiveFailures: failures,
    cooldownUntil,
    lastLatencyMs: probe.latencyMs ?? record.lastLatencyMs,
  };
}

export function isCoolingDown(record: ProviderRecord, now: number): boolean {
  return typeof record.cooldownUntil === 'number' && record.cooldownUntil > now;
}

/**
 * Eligibility rule, deliberately narrow: the *cooldown window* is what excludes a
 * provider, not its last bad label. A rate-limited provider whose window has lapsed
 * becomes routable again with no human in the loop — that is the whole recovery
 * mechanism for quota exhaustion. Only `unhealthy` (a probe that proved the endpoint
 * is down) keeps a provider out until a probe proves it back up.
 */
export function isUsable(record: ProviderRecord, now: number): boolean {
  if (isCoolingDown(record, now)) return false;
  return record.health !== 'unhealthy';
}

export function healthPenalty(record: ProviderRecord): number {
  switch (record.health) {
    case 'available':
      return 0;
    case 'unknown':
      return 5;
    case 'degraded':
      return 20;
    default:
      return 100;
  }
}
