// ============================================================================
// Scoring: priority is earned every call, not written in a config file.
// ----------------------------------------------------------------------------
// The operator's rule: instead of hard-coding "1 OpenRouter, 2 Gemini, 3 HF",
// rank on observables so the ladder re-sorts itself as the platforms change:
//
//   score = capability + availability + quota + latency + reliability + task-fit − failures
//
// Every term below is derived from something the router can actually see (a probe,
// a counter, a declared model list). Nothing here is a vibe: if a provider cannot
// be observed, it scores the "unknown" value, which is deliberately worse than a
// healthy provider and better than a failing one.
//
// Weights sum to 100 so a score reads like a percentage of confidence, and
// `parts` is returned alongside it because "why 63?" must be answerable from the
// evidence file weeks later.
// ============================================================================

import { allowanceRemaining } from './free-first.ts';
import type { CapabilityRequirement, ProviderRecord } from './types.ts';

export interface ScoreParts {
  capability: number;
  availability: number;
  quota: number;
  latency: number;
  reliability: number;
  taskFit: number;
  penalty: number;
  /** Operator nudge from `priority`; small on purpose — it breaks ties, it does not decide. */
  bias: number;
}

export const WEIGHTS = { capability: 22, availability: 20, quota: 18, latency: 12, reliability: 14, taskFit: 14 } as const;

/** What each kind of work quietly requires beyond the hard capability list. */
const IMPLIED: Record<string, string[]> = {
  coding: ['tool.calling', 'structured.output', 'long.context'],
  reasoning: ['structured.output', 'long.context'],
  'fast-experiment': ['streaming', 'tool.calling'],
  chat: ['streaming'],
  vision: ['vision'],
  embedding: [],
};

const AVAILABILITY: Record<string, number> = {
  available: WEIGHTS.availability,
  unknown: 13,
  degraded: 9,
  rate_limited: 5,
  cooldown: 4,
  quota_exceeded: 3,
  unhealthy: 0,
};

function latencyScore(ms: number | undefined): number {
  if (ms === undefined) return 7;
  if (ms <= 500) return WEIGHTS.latency;
  if (ms <= 1500) return 10;
  if (ms <= 4000) return 6;
  if (ms <= 10_000) return 3;
  return 1;
}

export interface ScoreContext {
  requirement: CapabilityRequirement;
  now?: number;
  /** Free-runway from `evaluateFreeFirst`; recomputed here when not supplied. */
  runway?: number;
}

export function scoreProvider(record: ProviderRecord, context: ScoreContext): { score: number; parts: ScoreParts } {
  const now = context.now ?? Date.now();
  const requirement = context.requirement;
  const implied = [...new Set(requirement.capabilities.filter((c) => !['chat'].includes(c))), ...(IMPLIED[requirement.taskKind ?? 'chat'] ?? [])];
  const covered = implied.length === 0 ? 1 : implied.filter((cap) => record.capabilities.includes(cap)).length / implied.length;
  // Hard requirements are already satisfied (the capability stage ran first), so this
  // term measures headroom: can this provider also do the things this task implies?
  const capability = 12 + 10 * covered;

  const availability = AVAILABILITY[record.health] ?? 6;

  let quota = context.runway === undefined ? 11 : context.runway * WEIGHTS.quota;
  if (record.freeTier) {
    const { runway } = allowanceRemaining(record.freeTier, now);
    quota = context.runway === undefined ? runway * WEIGHTS.quota : Math.min(quota, context.runway * WEIGHTS.quota);
    if (record.freeTier.basis === 'unlimited-local') quota = WEIGHTS.quota;
  }

  const latency = latencyScore(record.lastLatencyMs ?? record.probe?.latencyMs);

  const failures = record.consecutiveFailures ?? 0;
  const reliability = record.probe ? Math.max(0, WEIGHTS.reliability - failures * 4) : 9;

  const wanted = requirement.taskKind ? [requirement.taskKind] : [];
  const fits = record.taskFit ?? [];
  const taskFit = wanted.length === 0 || fits.length === 0
    ? 6
    : 4 + 10 * (wanted.filter((w) => fits.includes(w)).length / wanted.length);

  const penalty = Math.min(30, failures * 6 + (typeof record.cooldownUntil === 'number' && record.cooldownUntil > now ? 4 : 0));

  // `prefer` reweights the two terms an operator would argue about, without touching
  // eligibility — a cheap-but-slow provider still cannot jump a hard failure.
  const bias = requirement.prefer === 'cheapest' ? { quota: 1.4, latency: 0.6 } : requirement.prefer === 'fastest' ? { quota: 0.8, latency: 1.6 } : { quota: 1, latency: 1 };

  const parts: ScoreParts = {
    capability: round(capability),
    availability: round(availability),
    quota: round(quota * bias.quota),
    latency: round(latency * bias.latency),
    reliability: round(reliability),
    taskFit: round(taskFit),
    penalty: round(penalty),
    bias: round(clamp((60 - record.priority) / 30, -2, 2)),
  };

  const raw = parts.capability + parts.availability + parts.quota + parts.latency + parts.reliability + parts.taskFit + parts.bias - parts.penalty;
  return { score: Math.round(clamp(raw, 0, 100)), parts };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `OpenRouter: 92 · Gemini: 88 · Local: 51` — the ranking, auditable line by line. */
export function formatScores(entries: Array<{ id: string; score: number }>): string {
  return entries.map((e) => `${e.id}: ${e.score}`).join(' · ');
}
