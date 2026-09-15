// ============================================================================
// FREE_ONLY: the entitlement gate. It runs before any ranking, and it is a policy,
// not a preference.
// ----------------------------------------------------------------------------
// The rule this module implements, verbatim from the operator:
//
//     AGI-OS runs on free APIs first and never upgrades to a paid API automatically.
//
// Why it needs its own module instead of a line in the router: "free" is a
// different physical thing on every platform, and each one fails differently.
//
//   OpenRouter    `openrouter/free` picks among ~25 free models — free per call,
//                 but the free pool empties as models hit their own limits.
//   Gemini        free tier exists, but limits are per model *and* per account →
//                 quota-aware, never "unlimited free".
//   Cerebras      $5 of trial credit: free *until spent*, then metered.
//   Hugging Face  $0.10/month of Inference Providers credit; past it, calls are
//                 billed to the account → the router must stop at zero.
//   Cloudflare    10,000 neurons/day, and some models are paid-plan only → the
//                 *model* has to be checked, not just the provider.
//   Local         no per-call cost at all; the floor that keeps a mission alive.
//
// So the gate answers three separable questions: is this provider free *by
// nature*, is it free *right now*, and is the *specific model* free.
// `quota.ts` still owns request pacing (per-minute); entitlement is owned here.
// ============================================================================

import type { CapabilityRequirement, FreeTier, HealthState, ProviderRecord } from './types.ts';

export type FreeStage = 'free' | 'quota';

export interface FreeVerdict {
  allowed: boolean;
  /** Which router stage rejected it, so the trace reads as a pipeline, not a blob. */
  stage: FreeStage;
  /** Health the provider should carry after this verdict (drains the ladder). */
  state?: Extract<HealthState, 'available' | 'quota_exceeded' | 'rate_limited'>;
  reason: string;
  /** Remaining allowance as 0..1 for scoring; 1 when the allowance is unmeasurable. */
  runway: number;
  /** Written to the evidence ledger — this is what a reviewer reads afterwards. */
  evidence: Record<string, unknown>;
}

/** Remaining units on a free tier, derived rather than trusted. */
export function allowanceRemaining(tier: FreeTier, now = Date.now()): { remaining: number; limit: number; runway: number; expiredWindow: boolean } {
  const limit = Math.max(0, Number(tier.limit) || 0);
  const expiredWindow = typeof tier.resetsAt === 'number' && tier.resetsAt <= now;
  if (tier.basis === 'unlimited-local') return { remaining: Infinity, limit: Infinity, runway: 1, expiredWindow: false };
  if (typeof tier.remaining === 'number' && !expiredWindow) {
    const remaining = Math.max(0, tier.remaining);
    return { remaining, limit, runway: limit > 0 ? Math.min(1, remaining / limit) : remaining > 0 ? 1 : 0, expiredWindow: false };
  }
  // No live counter: start from the declared allowance minus whatever has been used.
  const used = expiredWindow ? 0 : Math.max(0, Number(tier.used) || 0);
  const remaining = Math.max(0, limit - used);
  return { remaining, limit, runway: limit > 0 ? Math.min(1, remaining / limit) : 1, expiredWindow };
}

/** A human decision, never a router decision: only an explicit grant opens a paid path. */
export function paidOverrideGranted(record: ProviderRecord, requirement?: CapabilityRequirement): boolean {
  if (record.paidOverride === true) return true;
  if (requirement?.allowPaidOverride !== true) return false;
  return (requirement.approvals ?? []).includes('paid:override');
}

export interface FreeFirstInput {
  record: ProviderRecord;
  requirement?: CapabilityRequirement;
  /** Default true. `false` is only reachable through an operator flag, never a default. */
  freeOnly?: boolean;
  /** Which router is asking: subscription adapters may not serve model calls. */
  plane?: 'agent' | 'model';
  now?: number;
}

export function evaluateFreeFirst(input: FreeFirstInput): FreeVerdict {
  const { record } = input;
  const requirement = input.requirement ?? { capabilities: [] };
  const now = input.now ?? Date.now();
  const plane = input.plane ?? 'model';
  const billing = record.billing ?? 'free-tier';
  const tier = record.freeTier;
  const base = { provider: record.id, billing, basis: tier?.basis ?? null, model: requirement.model ?? record.model ?? null };
  const override = paidOverrideGranted(record, requirement);

  // ── is it free by nature? ───────────────────────────────────────────────
  if (billing === 'paid' && !override) {
    return {
      allowed: false,
      stage: 'free',
      state: 'quota_exceeded',
      runway: 0,
      reason: 'paid API — FREE_ONLY forbids an automatic upgrade; needs an explicit `paid:override` approval',
      evidence: { ...base, verdict: 'BLOCKED_PAID', policy: 'FREE_ONLY' },
    };
  }

  if (billing === 'subscription') {
    if (plane === 'model') {
      return {
        allowed: false,
        stage: 'free',
        state: undefined,
        runway: 0,
        reason: 'subscription adapter cannot answer model calls — the Agent Router owns this provider',
        evidence: { ...base, verdict: 'WRONG_PLANE', plane },
      };
    }
    if (!override && billing !== 'free-tier') {
      // Subscription ≠ free per call: allowed for agent work, recorded as such.
      return {
        allowed: true,
        stage: 'free',
        state: 'available',
        runway: 0.5,
        reason: 'subscription account already paid for; no per-call cost incurred by this mission',
        evidence: { ...base, verdict: 'SUBSCRIPTION_OK', plane, note: 'not a free API — an already-billed one' },
      };
    }
  }

  // ── is the specific model free? (Cloudflare/Gemini: free tiers are per model) ──
  const freeModels = tier?.freeModels ?? record.freeModels;
  const requested = requirement.model ?? record.model;
  if (freeModels && freeModels.length > 0) {
    if (requested && !freeModels.includes(requested)) {
      return {
        allowed: false,
        stage: 'free',
        state: 'quota_exceeded',
        runway: 0,
        reason: `model "${requested}" is not on ${record.id}'s free plan (free: ${freeModels.slice(0, 6).join(', ')}${freeModels.length > 6 ? `, +${freeModels.length - 6}` : ''})`,
        evidence: { ...base, verdict: 'MODEL_NOT_FREE', freeModels: freeModels.slice(0, 12) },
      };
    }
  }

  // ── is it free right now? ───────────────────────────────────────────────
  if (!tier) {
    return {
      allowed: true,
      stage: 'free',
      state: 'available',
      runway: 0.6,
      reason: 'no free tier declared — treated as usable but unmeasured',
      evidence: { ...base, verdict: 'NO_TIER_DECLARED', note: 'declare a freeTier so the allowance is enforced instead of assumed' },
    };
  }

  const { remaining, limit, runway, expiredWindow } = allowanceRemaining(tier, now);
  if (remaining <= 0) {
    if (tier.hardStop !== false || billing === 'trial-credit') {
      return {
        allowed: false,
        stage: 'quota',
        state: 'quota_exceeded',
        runway: 0,
        reason:
        tier.basis === 'trial-usd'
          ? `trial credit spent (${formatUnits(tier, limit)} granted on this account) — continuing would start billing, so we move to the next provider`
          : `${tier.basis} allowance exhausted (${formatUnits(tier, 0)} of ${formatUnits(tier, limit)}) — hard stop, ${record.id} would bill this call`,
        evidence: { ...base, verdict: 'QUOTA_EMPTY', hardStop: tier.hardStop !== false, remaining: 0, limit, resetsAt: tier.resetsAt ?? null },
      };
    }
    return {
      allowed: false,
      stage: 'quota',
      state: 'quota_exceeded',
      runway: 0,
      reason: `${tier.basis} allowance exhausted and hardStop is off — refusing anyway under FREE_ONLY`,
      evidence: { ...base, verdict: 'QUOTA_EMPTY_SOFT_CONFIG_REJECTED', remaining: 0 },
    };
  }

  return {
    allowed: true,
    stage: 'free',
    state: 'available',
    runway,
    reason: `free allowance available: ${formatUnits(tier, remaining)} of ${formatUnits(tier, limit)}${expiredWindow ? ' (window reset)' : ''}`,
    evidence: { ...base, verdict: 'FREE_OK', remaining, limit, runway: Number(runway.toFixed(3)), source: tier.source ?? null },
  };
}

function formatUnits(tier: FreeTier, value: number): string {
  if (!Number.isFinite(value)) return 'unlimited';
  const rounded = value >= 100 ? Math.round(value) : Number(value.toFixed(2));
  switch (tier.basis) {
    case 'usd-per-month':
    case 'trial-usd':
      return `$${rounded}`;
    case 'neurons-per-day':
      return `${rounded} neurons`;
    case 'tokens-per-day':
    case 'tokens-per-minute':
      return `${rounded} tokens`;
    case 'requests-per-day':
      return `${rounded} requests`;
    default:
      return String(rounded);
  }
}

/**
 * Charge one call against the free allowance. Returns a new record; the registry is
 * shared state. `remaining` is authoritative when the platform tells us, otherwise we
 * count down from the declared limit — an estimate, but one that is *conservative in
 * the right direction*: it can only over-count usage, never under-count it.
 */
export function consumeAllowance(record: ProviderRecord, units: number, now = Date.now()): ProviderRecord {
  const tier = record.freeTier;
  if (!tier || tier.basis === 'unlimited-local') return record;
  const { remaining, expiredWindow } = allowanceRemaining(tier, now);
  const used = (tier.used ?? 0) + units + (expiredWindow ? -Math.max(0, (tier.used ?? 0)) : 0);
  const next: FreeTier = {
    ...tier,
    used: Math.max(0, Math.round(used)),
    remaining: Math.max(0, Math.round(remaining - units)),
  };
  return { ...record, freeTier: next };
}

/** The terminal outcome the operator asked for, spelled exactly as they wrote it. */
export const NO_FREE_PROVIDER_AVAILABLE = 'NO_FREE_PROVIDER_AVAILABLE';
